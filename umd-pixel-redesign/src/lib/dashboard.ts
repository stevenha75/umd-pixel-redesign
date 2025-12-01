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
import { db } from "./firebase";
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

async function fetchExcusedEventIds(userId: string) {
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
    pixels: data.pixelCached ?? data.pixels ?? 0,
  };
}

function makeLeaderboardCursor(snapshot: QueryDocumentSnapshot): LeaderboardCursor {
  const data = snapshot.data() as UserDocument;
  const pixels = data.pixelCached ?? data.pixels ?? 0;
  return { pixels, id: snapshot.id };
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
  const userSnap = await getDoc(doc(db, "users", userId));
  if (!userSnap.exists()) {
    throw new Error("User document not found");
  }
  const userData = userSnap.data() || {};

  const settingsSnap = await getDoc(doc(db, "settings", "global"));
  const currentSemesterId = settingsSnap.data()?.currentSemesterId;
  const leaderboardEnabled = !!settingsSnap.data()?.isLeadershipOn;

  const pixelDeltaBySemester = (userData.pixelDeltaBySemester || {}) as Record<string, number>;
  const pixelDeltaLegacy = userData.pixelDelta ?? userData.pixeldelta ?? 0;
  const pixelDelta =
    currentSemesterId && pixelDeltaBySemester[currentSemesterId] !== undefined
      ? pixelDeltaBySemester[currentSemesterId]
      : pixelDeltaLegacy;

  const excusedEventIds = await fetchExcusedEventIds(userId);
  const pixelLogPage = await fetchPixelLogPageInternal(
    { userId, semesterId: currentSemesterId, includeTotal: true },
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
    const multiplier = multipliers[userId] || 0;
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
    const leaderboardSnap = await getDocs(buildLeaderboardQuery());
    leaderboard = leaderboardSnap.docs.map((docSnap) => mapLeaderboardRow(docSnap));
    leaderboardCursor =
      leaderboardSnap.docs.length === LEADERBOARD_PAGE_SIZE
        ? makeLeaderboardCursor(leaderboardSnap.docs[leaderboardSnap.docs.length - 1])
        : null;

    const userPixels = pixelTotal;
    const rankQuery = query(
      collection(db, "users"), 
      where("pixelCached", ">", userPixels)
    );
    const rankSnap = await getCountFromServer(rankQuery);
    rank = rankSnap.data().count + 1;
  }

  const name = `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Member";

  return {
    userName: name,
    email: userData.email || userData.slackEmail || "",
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
  const leaderboardSnap = await getDocs(buildLeaderboardQuery(cursor));
  const rows = leaderboardSnap.docs.map((docSnap) => mapLeaderboardRow(docSnap));
  const nextCursor =
    leaderboardSnap.docs.length === LEADERBOARD_PAGE_SIZE
      ? makeLeaderboardCursor(leaderboardSnap.docs[leaderboardSnap.docs.length - 1])
      : null;

  return { rows, nextCursor };
}
