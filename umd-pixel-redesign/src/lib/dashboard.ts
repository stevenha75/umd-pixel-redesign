import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  where,
  FirestoreError,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { toDate } from "./dates";
import type { EventDocument, UserDocument, ActivityDocument } from "./types";

export type PixelLogRow = {
  id: string;
  eventId: string;
  date: string;
  name: string;
  type: string;
  attendance: "Attended" | "Excused" | "Unexcused" | "No Show";
  pixelsAllocated: number;
  pixelsEarned: number;
};

export type LeaderboardRow = {
  id: string;
  name: string;
  pixels: number;
};

export type LeaderboardCursor = {
  pixels: number;
  id: string;
};

export type DashboardData = {
  resolvedUserId: string;
  userName: string;
  email: string;
  pixelTotal: number;
  pixelDelta: number;
  pixelLog: PixelLogRow[];
  pixelLogCursor: PixelLogCursor | null;
  pixelLogTotal: number;
  leaderboard: LeaderboardRow[];
  leaderboardEnabled: boolean;
  leaderboardCursor: LeaderboardCursor | null;
  activities: ActivityRow[];
  currentSemesterId: string | null;
  rank?: number;
};

export type PixelLogCursor = {
  date: number;
  id: string;
};

export type PixelLogPage = {
  rows: PixelLogRow[];
  nextCursor: PixelLogCursor | null;
  total?: number;
};

export type ActivityRow = {
  id: string;
  name: string;
  type: string;
  pixelsPer: number;
  multiplier: number;
  total: number;
};

const requiredTypes = ["GBM", "other_mandatory"];
export const PIXEL_LOG_PAGE_SIZE = 25;
export const LEADERBOARD_PAGE_SIZE = 10;

function isFailedPreconditionError(err: unknown): err is FirestoreError {
  return (err as FirestoreError | undefined)?.code === "failed-precondition";
}

function isPermissionDeniedError(err: unknown): err is FirestoreError {
  return (err as FirestoreError | undefined)?.code === "permission-denied";
}

function getUserPixelTotal(user: Partial<UserDocument>): number {
  return user.pixelCached ?? user.pixels ?? 0;
}

async function findUserDocByField(field: "slackId" | "email" | "slackEmail", value?: string | null) {
  if (!value) return null;
  const snap = await getDocs(
    query(collection(db, "users"), where(field, "==", value), limit(1))
  );
  return snap.empty ? null : snap.docs[0];
}

async function resolveDashboardUser(userId: string): Promise<{
  id: string;
  data: Partial<UserDocument>;
} | null> {
  const directSnap = await getDoc(doc(db, "users", userId));
  if (directSnap.exists()) {
    return { id: directSnap.id, data: (directSnap.data() || {}) as Partial<UserDocument> };
  }

  const bySlackId = await findUserDocByField("slackId", userId);
  if (bySlackId) {
    return { id: bySlackId.id, data: (bySlackId.data() || {}) as Partial<UserDocument> };
  }

  const rawEmail = auth.currentUser?.email?.trim();
  const emailCandidates = rawEmail
    ? Array.from(new Set([rawEmail, rawEmail.toLowerCase()]))
    : [];

  for (const email of emailCandidates) {
    const byEmail = await findUserDocByField("email", email);
    if (byEmail) {
      return { id: byEmail.id, data: (byEmail.data() || {}) as Partial<UserDocument> };
    }
  }

  for (const email of emailCandidates) {
    const bySlackEmail = await findUserDocByField("slackEmail", email);
    if (bySlackEmail) {
      return { id: bySlackEmail.id, data: (bySlackEmail.data() || {}) as Partial<UserDocument> };
    }
  }

  return null;
}

async function fetchExcusedEventIds(userId: string) {
  try {
    const excusedSnapshot = await getDocs(
      query(
        collectionGroup(db, "excused_absences"),
        where("userId", "==", userId),
        where("status", "==", "approved")
      )
    );
    const excusedEventIds = new Set<string>();
    excusedSnapshot.forEach((docSnap) => {
      const eventRef = docSnap.ref.parent.parent;
      if (eventRef) excusedEventIds.add(eventRef.id);
    });
    return excusedEventIds;
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return new Set<string>();
    }
    if (!isFailedPreconditionError(err)) {
      throw err;
    }

    const fallbackSnapshot = await getDocs(
      query(collectionGroup(db, "excused_absences"), where("userId", "==", userId))
    );

    const excusedEventIds = new Set<string>();
    fallbackSnapshot.forEach((docSnap) => {
      const data = docSnap.data() as { status?: string };
      if (data.status !== "approved") return;
      const eventRef = docSnap.ref.parent.parent;
      if (eventRef) excusedEventIds.add(eventRef.id);
    });

    return excusedEventIds;
  }
}

function mapEventToPixelRow(
  eventId: string,
  event: EventDocument,
  userId: string,
  excusedEventIds: Set<string>
): PixelLogRow {
  const attendees: string[] = event.attendees || [];
  const pixels: number = event.pixels || 0;
  const eventDate = toDate(event.date);

  let attendance: PixelLogRow["attendance"] = "No Show";

  if (attendees.includes(userId)) {
    attendance = "Attended";
  }
  if (excusedEventIds.has(eventId)) {
    attendance = "Excused";
  }
  if (requiredTypes.includes(event.type) && attendance === "No Show") {
    attendance = "Unexcused";
  }

  const pixelsEarned = attendance === "Attended" && pixels > 0 ? pixels : 0;

  return {
    id: `${eventId}-${userId}`,
    eventId,
    date: eventDate.toLocaleDateString(),
    name: event.name || "Event",
    type: event.type || "event",
    attendance,
    pixelsAllocated: pixels,
    pixelsEarned,
  };
}

function buildEventQuery(semesterId?: string | null, cursor?: PixelLogCursor | null) {
  const base = semesterId
    ? query(collection(db, "events"), where("semesterId", "==", semesterId))
    : collection(db, "events");

  const constraints = cursor
    ? [
        orderBy("date", "desc"),
        orderBy(documentId(), "desc"),
        startAfter(Timestamp.fromMillis(cursor.date), cursor.id),
        limit(PIXEL_LOG_PAGE_SIZE),
      ]
    : [orderBy("date", "desc"), orderBy(documentId(), "desc"), limit(PIXEL_LOG_PAGE_SIZE)];

  return query(base, ...constraints);
}

function makeCursor(snapshot: QueryDocumentSnapshot) {
  const data = snapshot.data();
  const dateVal = data?.date;
  const millis = dateVal && typeof (dateVal as Timestamp).toMillis === "function"
    ? (dateVal as Timestamp).toMillis()
    : toDate(dateVal).getTime();
  if (!millis) return null;
  return { date: millis, id: snapshot.id } satisfies PixelLogCursor;
}

async function fetchPixelLogPageInternal(
  {
    userId,
    semesterId,
    cursor,
    includeTotal,
  }: { userId: string; semesterId?: string | null; cursor?: PixelLogCursor | null; includeTotal?: boolean },
  excusedEventIds: Set<string>
): Promise<PixelLogPage> {
  try {
    const eventsSnap = await getDocs(buildEventQuery(semesterId, cursor));

    const rows = eventsSnap.docs.map((docSnap) =>
      mapEventToPixelRow(docSnap.id, docSnap.data() as EventDocument, userId, excusedEventIds)
    );

    const nextCursor =
      eventsSnap.docs.length === PIXEL_LOG_PAGE_SIZE
        ? makeCursor(eventsSnap.docs[eventsSnap.docs.length - 1])
        : null;

    let total: number | undefined;
    if (includeTotal) {
      const countSnap = await getCountFromServer(
        semesterId
          ? query(collection(db, "events"), where("semesterId", "==", semesterId))
          : collection(db, "events")
      );
      total = Number(countSnap.data().count || 0);
    }

    return { rows, nextCursor, total };
  } catch (err) {
    const code = (err as FirestoreError)?.code;
    if (code !== "failed-precondition") {
      throw err;
    }

    const baseQuery = semesterId
      ? query(collection(db, "events"), where("semesterId", "==", semesterId))
      : collection(db, "events");
    const snap = await getDocs(baseQuery);

    const sortedDocs = [...snap.docs].sort((a, b) => {
      const dateA = toDate((a.data() as EventDocument).date).getTime();
      const dateB = toDate((b.data() as EventDocument).date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return b.id.localeCompare(a.id);
    });

    const startIndex = cursor
      ? Math.max(0, sortedDocs.findIndex((d) => d.id === cursor?.id) + 1)
      : 0;

    const pageDocs = sortedDocs.slice(startIndex, startIndex + PIXEL_LOG_PAGE_SIZE);
    const nextCursor =
      startIndex + PIXEL_LOG_PAGE_SIZE < sortedDocs.length && pageDocs.length
        ? makeCursor(pageDocs[pageDocs.length - 1])
        : null;

    const rows = pageDocs.map((docSnap) =>
      mapEventToPixelRow(docSnap.id, docSnap.data() as EventDocument, userId, excusedEventIds)
    );

    const total = includeTotal ? sortedDocs.length : undefined;

    return { rows, nextCursor, total };
  }
}

function mapLeaderboardRow(docSnap: QueryDocumentSnapshot): LeaderboardRow {
  const data = docSnap.data() as UserDocument;
  const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Member";
  return {
    id: docSnap.id,
    name,
    pixels: getUserPixelTotal(data),
  };
}

function makeLeaderboardCursor(snapshot: QueryDocumentSnapshot): LeaderboardCursor {
  const data = snapshot.data() as UserDocument;
  const pixels = getUserPixelTotal(data);
  return { pixels, id: snapshot.id };
}

function compareLeaderboardDocs(a: QueryDocumentSnapshot, b: QueryDocumentSnapshot) {
  const pixelsA = getUserPixelTotal(a.data() as UserDocument);
  const pixelsB = getUserPixelTotal(b.data() as UserDocument);
  if (pixelsA !== pixelsB) return pixelsB - pixelsA;
  return b.id.localeCompare(a.id);
}

function buildLeaderboardQuery(cursor?: LeaderboardCursor | null) {
  const constraints = cursor
    ? [
        orderBy("pixelCached", "desc"),
        orderBy(documentId(), "desc"),
        startAfter(cursor.pixels, cursor.id),
        limit(LEADERBOARD_PAGE_SIZE),
      ]
    : [orderBy("pixelCached", "desc"), orderBy(documentId(), "desc"), limit(LEADERBOARD_PAGE_SIZE)];

  return query(collection(db, "users"), ...constraints);
}

async function fetchLeaderboardPageInternal({
  cursor,
}: { cursor?: LeaderboardCursor | null } = {}): Promise<{
  rows: LeaderboardRow[];
  nextCursor: LeaderboardCursor | null;
}> {
  try {
    const leaderboardSnap = await getDocs(buildLeaderboardQuery(cursor));
    const rows = leaderboardSnap.docs.map((docSnap) => mapLeaderboardRow(docSnap));
    const nextCursor =
      leaderboardSnap.docs.length === LEADERBOARD_PAGE_SIZE
        ? makeLeaderboardCursor(leaderboardSnap.docs[leaderboardSnap.docs.length - 1])
        : null;

    return { rows, nextCursor };
  } catch (err) {
    if (!isFailedPreconditionError(err)) {
      throw err;
    }

    const leaderboardSnap = await getDocs(collection(db, "users"));
    const sortedDocs = [...leaderboardSnap.docs].sort(compareLeaderboardDocs);
    const startIndex = cursor
      ? sortedDocs.findIndex((docSnap) => {
          const pixels = getUserPixelTotal(docSnap.data() as UserDocument);
          return pixels < cursor.pixels || (pixels === cursor.pixels && docSnap.id.localeCompare(cursor.id) < 0);
        })
      : 0;

    if (startIndex === -1) {
      return { rows: [], nextCursor: null };
    }

    const pageDocs = sortedDocs.slice(startIndex, startIndex + LEADERBOARD_PAGE_SIZE);
    const rows = pageDocs.map((docSnap) => mapLeaderboardRow(docSnap));
    const nextCursor =
      startIndex + LEADERBOARD_PAGE_SIZE < sortedDocs.length && pageDocs.length > 0
        ? makeLeaderboardCursor(pageDocs[pageDocs.length - 1])
        : null;

    return { rows, nextCursor };
  }
}

export async function fetchPixelLogPage({
  userId,
  semesterId,
  cursor,
  includeTotal = false,
}: {
  userId: string;
  semesterId?: string | null;
  cursor?: PixelLogCursor | null;
  includeTotal?: boolean;
}): Promise<PixelLogPage> {
  const excusedEventIds = await fetchExcusedEventIds(userId);
  return fetchPixelLogPageInternal({ userId, semesterId, cursor, includeTotal }, excusedEventIds);
}

export async function fetchDashboardData(userId: string): Promise<DashboardData> {
  const resolvedUser = await resolveDashboardUser(userId);
  const resolvedUserId = resolvedUser?.id ?? userId;
  const userData = resolvedUser?.data || {};

  const settingsSnap = await getDoc(doc(db, "settings", "global"));
  const currentSemesterId = settingsSnap.data()?.currentSemesterId;
  const leaderboardEnabled = !!settingsSnap.data()?.isLeadershipOn;

  const pixelDeltaBySemester = (userData.pixelDeltaBySemester || {}) as Record<string, number>;
  const pixelDeltaLegacy = userData.pixelDelta ?? userData.pixeldelta ?? 0;
  const pixelDelta =
    currentSemesterId && pixelDeltaBySemester[currentSemesterId] !== undefined
      ? pixelDeltaBySemester[currentSemesterId]
      : pixelDeltaLegacy;

  const excusedEventIds = await fetchExcusedEventIds(resolvedUserId);
  const pixelLogPage = await fetchPixelLogPageInternal(
    { userId: resolvedUserId, semesterId: currentSemesterId, includeTotal: true },
    excusedEventIds
  );

  const earnedPixelPageTotal = pixelLogPage.rows.reduce((sum, row) => sum + row.pixelsEarned, 0);

  const activities: ActivityRow[] = [];
  const activitiesQuery = currentSemesterId
    ? query(collection(db, "activities"), where("semesterId", "==", currentSemesterId))
    : collection(db, "activities");
  const activitiesSnap = await getDocs(activitiesQuery);
  activitiesSnap.forEach((docSnap) => {
    const data = docSnap.data() as ActivityDocument;
    const multipliers = data.multipliers || {};
    const multiplier = multipliers[resolvedUserId] || 0;
    if (multiplier) {
      const total = (data.pixels || 0) * multiplier;
      activities.push({
        id: docSnap.id,
        name: data.name || "Activity",
        type: data.type || "activity",
        pixelsPer: data.pixels || 0,
        multiplier,
        total,
      });
    }
  });

  const earnedPixels = earnedPixelPageTotal + activities.reduce((sum, act) => sum + act.total, 0);
  const pixelTotal = userData.pixelCached ?? userData.pixels ?? earnedPixels + pixelDelta;

  let leaderboard: LeaderboardRow[] = [];
  let leaderboardCursor: LeaderboardCursor | null = null;
  let rank: number | undefined;

  if (leaderboardEnabled) {
    const leaderboardPage = await fetchLeaderboardPageInternal();
    leaderboard = leaderboardPage.rows;
    leaderboardCursor = leaderboardPage.nextCursor;

    const userPixels = pixelTotal;
    try {
      const rankQuery = query(
        collection(db, "users"),
        where("pixelCached", ">", userPixels)
      );
      const rankSnap = await getCountFromServer(rankQuery);
      rank = rankSnap.data().count + 1;
    } catch (err) {
      if (!isFailedPreconditionError(err)) {
        throw err;
      }

      const rankFallbackSnap = await getDocs(collection(db, "users"));
      const higherPixelCount = rankFallbackSnap.docs.reduce((count, docSnap) => {
        const pixels = getUserPixelTotal(docSnap.data() as UserDocument);
        return pixels > userPixels ? count + 1 : count;
      }, 0);
      rank = higherPixelCount + 1;
    }
  }

  const name =
    `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
    auth.currentUser?.displayName ||
    "Member";

  return {
    resolvedUserId,
    userName: name,
    email: userData.email || userData.slackEmail || auth.currentUser?.email || "",
    pixelTotal,
    pixelDelta,
    pixelLog: pixelLogPage.rows,
    pixelLogCursor: pixelLogPage.nextCursor,
    pixelLogTotal: pixelLogPage.total ?? pixelLogPage.rows.length,
    leaderboard,
    leaderboardEnabled,
    leaderboardCursor,
    activities,
    currentSemesterId: currentSemesterId ?? null,
    rank,
  };
}

export async function fetchLeaderboardPage({
  cursor,
}: { cursor?: LeaderboardCursor | null } = {}): Promise<{
  rows: LeaderboardRow[];
  nextCursor: LeaderboardCursor | null;
}> {
  return fetchLeaderboardPageInternal({ cursor });
}
