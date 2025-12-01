import {
  Timestamp,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  QueryDocumentSnapshot,
  query,
  startAfter,
  updateDoc,
  where,
  setDoc,
  type FirestoreError,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { toDate } from "./dates";
import type {
  EventDocument,
  UserDocument,
  ActivityDocument,
  ExcusedAbsenceDocument,
  SlackUser,
} from "./types";

export { SlackUser };


export type EventRecord = {
  id: string;
  name: string;
  date: string;
  type: string;
  pixels: number;
  attendeesCount: number;
  attendees: Attendee[];
};

export type ExcusedRequest = {
  id: string;
  eventId: string;
  eventName: string;
  userId: string;
  userName: string;
  userEmail: string;
  reason: string;
  status: string;
};

export type AdminData = {
  events: EventRecord[];
  excused: ExcusedRequest[];
  currentSemesterId: string | null;
};

export type EventInput = {
  name: string;
  date: string; // ISO string
  type: string;
  pixels: number;
};

export type Attendee = {
  id: string;
  name: string;
  email: string;
};

export type MemberRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pixels: number;
  pixelDelta: number;
  rank?: number;
  slackId?: string;
};

export type ActivityRecord = {
  id: string;
  name: string;
  type: string;
  pixels: number;
  semesterId?: string;
  multipliers: { userId: string; multiplier: number }[];
};

export type ActivityCursor = {
  name: string;
  id: string;
};

export type ActivityPage = {
  rows: ActivityRecord[];
  nextCursor: ActivityCursor | null;
  total?: number;
};

export const ACTIVITIES_PAGE_SIZE = 20;


export async function fetchAdminData(): Promise<AdminData> {
  const settingsSnap = await getDoc(doc(db, "settings", "global"));
  const currentSemesterId = settingsSnap.data()?.currentSemesterId || null;

  const eventsQuery = currentSemesterId
    ? query(
        collection(db, "events"),
        where("semesterId", "==", currentSemesterId),
        orderBy("date", "desc")
      )
    : query(collection(db, "events"), orderBy("date", "desc"));

  let eventsSnap;
  try {
    eventsSnap = await getDocs(eventsQuery);
  } catch (err) {
    const code = (err as FirestoreError)?.code;
    if (code !== "failed-precondition") throw err;
    // Fall back when the composite index is missing.
    const fallbackQuery = currentSemesterId
      ? query(collection(db, "events"), where("semesterId", "==", currentSemesterId))
      : collection(db, "events");
    eventsSnap = await getDocs(fallbackQuery);
  }
  const events: EventRecord[] = [];
  const eventNameMap = new Map<string, string>();

  const attendeeIds = new Set<string>();
  const eventIds = new Set<string>();

  eventsSnap.forEach((d) => {
    const data = d.data() as EventDocument;
    const dateVal = toDate(data.date);
    const name = data.name || "Event";
    const attendees: string[] = data.attendees || [];
    attendees.forEach((id) => attendeeIds.add(id));
    events.push({
      id: d.id,
      name,
      date: dateVal.toISOString(),
      type: data.type || "GBM",
      pixels: data.pixels || 0,
      attendeesCount: attendees.length,
      attendees: [],
    });
    eventNameMap.set(d.id, name);
    eventIds.add(d.id);
  });

  const excused: ExcusedRequest[] = [];
  const userIds = new Set<string>(attendeeIds);
  let excusedSnap;
  try {
    excusedSnap = await getDocs(
      query(collectionGroup(db, "excused_absences"), orderBy("createdAt", "desc"))
    );
  } catch (err) {
    const code = (err as FirestoreError)?.code;
    if (code !== "failed-precondition") throw err;
    excusedSnap = await getDocs(collectionGroup(db, "excused_absences"));
  }

  excusedSnap.forEach((d) => {
    const data = d.data() as ExcusedAbsenceDocument;
    const eventId = d.ref.parent.parent?.id || "";
    if (currentSemesterId && !eventIds.has(eventId)) return;
    excused.push({
      id: d.id,
      eventId,
      eventName: eventNameMap.get(eventId) || "Event",
      userId: data.userId || "",
      userName: "",
      userEmail: "",
      reason: data.reason || "",
      status: data.status || "pending",
    });
    if (data.userId) userIds.add(data.userId);
  });

  const userDetails = new Map<string, { name: string; email: string }>();

  const userIdList = Array.from(userIds).filter(Boolean);
  const chunkSize = 10;
  for (let i = 0; i < userIdList.length; i += chunkSize) {
    const slice = userIdList.slice(i, i + chunkSize);
    const snap = await getDocs(
      query(collection(db, "users"), where(documentId(), "in", slice))
    );
    snap.forEach((doc) => {
      const data = doc.data() as UserDocument;
      const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Member";
      const email = data.email || data.slackEmail || "";
      userDetails.set(doc.id, { name, email });
    });
  }

  excused.forEach((row) => {
    const details = userDetails.get(row.userId);
    if (details) {
      row.userName = details.name;
      row.userEmail = details.email;
    }
  });

  events.forEach((evt) => {
    const snap = eventsSnap.docs.find((d) => d.id === evt.id);
    const data = snap?.data() as EventDocument | undefined;
    const attendees: string[] = data?.attendees || [];
    evt.attendees = attendees.map((id) => {
      const details = userDetails.get(id);
      return {
        id,
        name: details?.name || id,
        email: details?.email || "",
      };
    });
  });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { events, excused, currentSemesterId };
}

export async function createEvent(input: EventInput, semesterId: string | null) {
  let targetSemesterId = semesterId;
  if (!targetSemesterId) {
    const settingsSnap = await getDoc(doc(db, "settings", "global"));
    targetSemesterId = settingsSnap.data()?.currentSemesterId || "";
  }

  if (!targetSemesterId) {
    throw new Error("No current semester set. Please configure it in admin settings.");
  }

  const dateObj = input.date ? new Date(input.date) : new Date();
  const dateValue = Timestamp.fromDate(dateObj);
  const newEvent = {
    name: input.name,
    semesterId: targetSemesterId,
    date: dateValue,
    type: input.type,
    pixels: Number(input.pixels) || 0,
    attendees: [],
  };
  const created = await addDoc(collection(db, "events"), newEvent);
  return {
    id: created.id,
    name: newEvent.name,
    date: dateObj.toISOString(),
    type: newEvent.type,
    pixels: newEvent.pixels,
    attendeesCount: 0,
  } as EventRecord;
}

export async function updateEvent(eventId: string, input: EventInput) {
  const dateObj = input.date ? new Date(input.date) : new Date();
  const dateValue = Timestamp.fromDate(dateObj);
  await updateDoc(doc(db, "events", eventId), {
    name: input.name,
    type: input.type,
    pixels: Number(input.pixels) || 0,
    date: dateValue,
  });
  return {
    id: eventId,
    name: input.name,
    date: dateObj.toISOString(),
    type: input.type,
    pixels: Number(input.pixels) || 0,
  };
}

export async function deleteEventById(eventId: string) {
  await deleteDoc(doc(db, "events", eventId));
}

export async function updateEventPixels(eventId: string, pixels: number) {
  await updateDoc(doc(db, "events", eventId), { pixels: Number(pixels) || 0 });
}

export async function updateExcusedStatus(eventId: string, requestId: string, status: string) {
  await updateDoc(doc(db, "events", eventId, "excused_absences", requestId), { status });
}

export async function addAttendee(eventId: string, userId: string) {
  await updateDoc(doc(db, "events", eventId), {
    attendees: arrayUnion(userId),
  });
}

export async function removeAttendee(eventId: string, userId: string) {
  await updateDoc(doc(db, "events", eventId), {
    attendees: arrayRemove(userId),
  });
}

export async function setAttendanceStatus(
  eventId: string,
  userId: string,
  status: "present" | "excused" | "absent"
) {
  const eventRef = doc(db, "events", eventId);
  if (status === "present") {
    await updateDoc(eventRef, { attendees: arrayUnion(userId) });
    // remove excused if exists
    const excused = await getDocs(
      query(collection(eventRef, "excused_absences"), where("userId", "==", userId))
    );
    await Promise.all(excused.docs.map((d) => deleteDoc(d.ref)));
  } else if (status === "excused") {
    await updateDoc(eventRef, { attendees: arrayRemove(userId) });
    const existing = await getDocs(
      query(collection(eventRef, "excused_absences"), where("userId", "==", userId))
    );
    if (existing.empty) {
      await addDoc(collection(eventRef, "excused_absences"), {
        userId,
        status: "approved",
        reason: "Marked excused by admin",
        createdAt: Timestamp.now(),
      });
    } else {
      await Promise.all(existing.docs.map((d) => updateDoc(d.ref, { status: "approved" })));
    }
  } else {
    await updateDoc(eventRef, { attendees: arrayRemove(userId) });
    const existing = await getDocs(
      query(collection(eventRef, "excused_absences"), where("userId", "==", userId))
    );
    await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
  }
}

export async function fetchMembers(): Promise<MemberRecord[]> {
  const settingsSnap = await getDoc(doc(db, "settings", "global"));
  const currentSemesterId = settingsSnap.data()?.currentSemesterId || null;

  const snap = await getDocs(query(collection(db, "users"), orderBy("pixelCached", "desc")));
  return snap.docs.map((d, idx) => {
    const data = d.data() as UserDocument;
    const pixelDeltaBySemester = (data.pixelDeltaBySemester || {}) as Record<string, number>;
    const pixelDeltaLegacy = data.pixelDelta ?? data.pixeldelta ?? 0;
    const pixelDelta =
      currentSemesterId && pixelDeltaBySemester[currentSemesterId] !== undefined
        ? pixelDeltaBySemester[currentSemesterId]
        : pixelDeltaLegacy;
    return {
      id: d.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.email || data.slackEmail || "",
      pixels: data.pixelCached ?? data.pixels ?? 0,
      pixelDelta,
      rank: idx + 1,
      slackId: data.slackId,
    };
  });
}

export async function addMember(data: { firstName: string; lastName: string; email: string }) {
  const docRef = await addDoc(collection(db, "users"), {
    ...data,
    isAdmin: false,
    pixelDelta: 0,
    pixelCached: 0,
    createdAt: Timestamp.now(),
  });
  return { id: docRef.id, ...data, pixels: 0, pixelDelta: 0 };
}

export async function updateMember(userId: string, data: Partial<MemberRecord>) {
  await updateDoc(doc(db, "users", userId), {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
  });
}

export async function deleteMember(userId: string) {
  await deleteDoc(doc(db, "users", userId));
}

export async function setAdminByEmail(email: string, isAdmin: boolean) {
  const normalized = email.trim().toLowerCase();
  const matches = new Set<string>();

  const direct = await getDocs(
    query(collection(db, "users"), where("email", "==", normalized), limit(20))
  );
  direct.forEach((d) => matches.add(d.id));

  const slack = await getDocs(
    query(collection(db, "users"), where("slackEmail", "==", normalized), limit(20))
  );
  slack.forEach((d) => matches.add(d.id));

  if (!matches.size) {
    throw new Error("No user found with that email.");
  }

  await Promise.all(Array.from(matches).map((id) => updateDoc(doc(db, "users", id), { isAdmin })));
  return matches.size;
}

export async function setPixelDelta(
  userId: string,
  pixelDelta: number,
  semesterId: string | null
) {
  const updates: Record<string, unknown> = {
    pixelDelta,
  };
  if (semesterId) {
    updates[`pixelDeltaBySemester.${semesterId}`] = pixelDelta;
  }
  await updateDoc(doc(db, "users", userId), updates);
}

export async function recalculateUserPixels(userId: string) {
  const fn = httpsCallable<{ userId: string }, { success: boolean }>(
    functions,
    "recalculateUserPixelsCallable"
  );
  await fn({ userId });
}

export async function addAttendeesByEmail(eventId: string, emails: string[]) {
  const unique = Array.from(new Set(emails.map((e) => e.trim()).filter(Boolean)));
  const foundIds: string[] = [];
  for (const email of unique) {
    const snap = await getDocs(
      query(collection(db, "users"), where("email", "==", email.toLowerCase()))
    );
    snap.forEach((d) => foundIds.push(d.id));
  }
  if (foundIds.length) {
    await updateDoc(doc(db, "events", eventId), {
      attendees: arrayUnion(...foundIds),
    });
  }
  return foundIds;
}

function buildActivitiesQuery(semesterId?: string, cursor?: ActivityCursor | null, pageSize = ACTIVITIES_PAGE_SIZE) {
  const base = collection(db, "activities");
  const filters = semesterId ? [where("semesterId", "==", semesterId)] : [];

  const constraints = cursor
    ? [
        ...filters,
        orderBy("name", "asc"),
        orderBy(documentId(), "asc"),
        startAfter(cursor.name, cursor.id),
        limit(pageSize),
      ]
    : [...filters, orderBy("name", "asc"), orderBy(documentId(), "asc"), limit(pageSize)];

  return query(base, ...constraints);
}

export async function fetchActivitiesPage({
  semesterId,
  cursor,
  includeTotal = false,
}: {
  semesterId?: string;
  cursor?: ActivityCursor | null;
  includeTotal?: boolean;
}): Promise<ActivityPage> {
  const base = collection(db, "activities");

  const mapDoc = (d: QueryDocumentSnapshot) => {
    const data = d.data() as ActivityDocument;
    const multipliers = Object.entries(data.multipliers || {}).map(([userId, multiplier]) => ({
      userId,
      multiplier: Number(multiplier),
    }));
    return {
      id: d.id,
      name: data.name || "Activity",
      type: data.type || "other",
      pixels: data.pixels || 0,
      semesterId: data.semesterId,
      multipliers,
    };
  };

  try {
    const snap = await getDocs(buildActivitiesQuery(semesterId, cursor));
    const rows = snap.docs.map((d) => mapDoc(d));
    const nextCursor =
      snap.docs.length === ACTIVITIES_PAGE_SIZE
        ? { name: rows[rows.length - 1].name, id: snap.docs[snap.docs.length - 1].id }
        : null;

    let total: number | undefined;
    if (includeTotal) {
      const countQuery = semesterId ? query(base, where("semesterId", "==", semesterId)) : base;
      const countSnap = await getCountFromServer(countQuery);
      total = Number(countSnap.data().count || 0);
    }

    return { rows, nextCursor, total };
  } catch (err) {
    const code = (err as FirestoreError)?.code;
    if (code !== "failed-precondition") throw err;

    const fallbackQuery = semesterId
      ? query(base, where("semesterId", "==", semesterId))
      : base;
    const snap = await getDocs(fallbackQuery);

    const docs = snap.docs
      .map((d) => ({ doc: d, data: d.data() as ActivityDocument }))
      .sort((a, b) => {
        const nameCompare = (a.data.name || "").localeCompare(b.data.name || "");
        if (nameCompare !== 0) return nameCompare;
        return a.doc.id.localeCompare(b.doc.id);
      });

    const startIndex = cursor ? Math.max(0, docs.findIndex((d) => d.doc.id === cursor.id) + 1) : 0;
    const pageDocs = docs.slice(startIndex, startIndex + ACTIVITIES_PAGE_SIZE);

    const rows = pageDocs.map(({ doc }) => mapDoc(doc));
    const nextCursor =
      startIndex + ACTIVITIES_PAGE_SIZE < docs.length && pageDocs.length
        ? { name: rows[rows.length - 1].name, id: rows[rows.length - 1].id }
        : null;

    const total = includeTotal ? docs.length : undefined;

    return { rows, nextCursor, total };
  }
}

export async function fetchActivities(semesterId?: string): Promise<ActivityRecord[]> {
  let cursor: ActivityCursor | null = null;
  const all: ActivityRecord[] = [];
  do {
    const page = await fetchActivitiesPage({ semesterId, cursor });
    all.push(...page.rows);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

export async function createActivity(input: {
  name: string;
  type: string;
  pixels: number;
  semesterId?: string;
}) {
  const docRef = await addDoc(collection(db, "activities"), {
    ...input,
    multipliers: {},
    createdAt: Timestamp.now(),
  });
  return { id: docRef.id, ...input, multipliers: [] } as ActivityRecord;
}

export async function updateActivity(activityId: string, data: Partial<ActivityRecord>) {
  await updateDoc(doc(db, "activities", activityId), {
    name: data.name,
    type: data.type,
    pixels: data.pixels,
    semesterId: data.semesterId,
  });
}

export async function deleteActivity(activityId: string) {
  await deleteDoc(doc(db, "activities", activityId));
}

export async function setActivityMultiplier(activityId: string, userId: string, multiplier: number) {
  await updateDoc(doc(db, "activities", activityId), {
    [`multipliers.${userId}`]: multiplier,
  });
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const snap = await getDocs(
    query(collection(db, "users"), where("email", "==", email.toLowerCase()))
  );
  if (snap.empty) return null;
  return snap.docs[0].id;
}

export async function fetchUserDetails(ids: string[]) {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();

  const details = new Map<string, { name: string; email: string }>();
  const chunks = [];
  for (let i = 0; i < unique.length; i += 30) {
    chunks.push(unique.slice(i, i + 30));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(collection(db, "users"), where(documentId(), "in", chunk));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data() as UserDocument;
        const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Member";
        const email = data.email || data.slackEmail || "";
        details.set(d.id, { name, email });
      });
    })
  );
  return details;
}

export async function fetchSlackUsers(): Promise<SlackUser[]> {
  const getSlackUsersFn = httpsCallable<Record<string, never>, { members: SlackUser[] }>(
    functions,
    "getSlackUsers"
  );
  const result = await getSlackUsersFn({});
  return result.data.members;
}

export async function addSlackMember(user: SlackUser) {
  // Check if user exists by ID
  const userDoc = await getDoc(doc(db, "users", user.id));
  if (userDoc.exists()) {
    throw new Error("User already exists (Slack ID match).");
  }

  // Check if user exists by email (to prevent duplicates)
  const emailQuery = await getDocs(
    query(collection(db, "users"), where("email", "==", user.email))
  );
  if (!emailQuery.empty) {
    throw new Error(`User with email ${user.email} already exists.`);
  }

  const nameParts = (user.real_name || user.name).split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "";

  await setDoc(doc(db, "users", user.id), {
    firstName,
    lastName,
    email: user.email,
    slackId: user.id,
    isAdmin: false,
    pixels: 0,
    pixelCached: 0,
    pixelDelta: 0,
    createdAt: Timestamp.now(),
  });
}
