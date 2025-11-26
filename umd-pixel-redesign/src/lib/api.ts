import {
  Timestamp,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  EventDocument,
  UserDocument,
  ActivityDocument,
  ExcusedAbsenceDocument,
} from "./types";

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
};

export type ActivityRecord = {
  id: string;
  name: string;
  type: string;
  pixels: number;
  semesterId?: string;
  multipliers: { userId: string; multiplier: number }[];
};

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

  const eventsSnap = await getDocs(eventsQuery);
  const events: EventRecord[] = [];
  const eventNameMap = new Map<string, string>();

  const attendeeIds = new Set<string>();

  eventsSnap.forEach((d) => {
    const data = d.data() as EventDocument;
    const dateVal =
      data.date?.toDate?.() ??
      (data.date instanceof Date ? data.date : new Date(data.date || Date.now()));
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
  });

  const excusedSnap = await getDocs(
    query(collectionGroup(db, "excused_absences"), orderBy("createdAt", "desc"))
  );

  const excused: ExcusedRequest[] = [];
  const userIds = new Set<string>(attendeeIds);
  excusedSnap.forEach((d) => {
    const data = d.data() as ExcusedAbsenceDocument;
    const eventId = d.ref.parent.parent?.id || "";
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
  await Promise.all(
    Array.from(userIds).map(async (uid) => {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const data = userSnap.data() as UserDocument;
        const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Member";
        const email = data.email || data.slackEmail || "";
        userDetails.set(uid, { name, email });
      }
    })
  );

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

  return { events, excused, currentSemesterId };
}

export async function createEvent(input: EventInput, semesterId: string | null) {
  const dateObj = input.date ? new Date(input.date) : new Date();
  const dateValue = Timestamp.fromDate(dateObj);
  const newEvent = {
    name: input.name,
    semesterId: semesterId || "",
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
  const snap = await getDocs(query(collection(db, "users"), orderBy("pixelCached", "desc")));
  return snap.docs.map((d, idx) => {
    const data = d.data() as UserDocument;
    return {
      id: d.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.email || data.slackEmail || "",
      pixels: data.pixelCached ?? data.pixels ?? 0,
      pixelDelta: data.pixelDelta ?? data.pixeldelta ?? 0,
      rank: idx + 1,
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

export async function setAdminFlag(userId: string, isAdmin: boolean) {
  await updateDoc(doc(db, "users", userId), { isAdmin });
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

export async function fetchActivities(semesterId?: string): Promise<ActivityRecord[]> {
  const base = collection(db, "activities");
  const q = semesterId
    ? query(base, where("semesterId", "==", semesterId), orderBy("name", "asc"))
    : query(base, orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
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
  });
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
  const details = new Map<string, { name: string; email: string }>();
  await Promise.all(
    unique.map(async (id) => {
      const snap = await getDoc(doc(db, "users", id));
      if (snap.exists()) {
        const data = snap.data() as UserDocument;
        const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Member";
        const email = data.email || data.slackEmail || "";
        details.set(id, { name, email });
      }
    })
  );
  return details;
}
