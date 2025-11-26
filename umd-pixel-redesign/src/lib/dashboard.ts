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
  const pixelDelta = userData.pixelDelta ?? userData.pixeldelta ?? 0;

  const settingsSnap = await getDoc(doc(db, "settings", "global"));
  const currentSemesterId = settingsSnap.data()?.currentSemesterId;
  const leaderboardEnabled = !!settingsSnap.data()?.isLeadershipOn;

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
  if (leaderboardEnabled) {
    const leaderboardSnap = await getDocs(
      query(collection(db, "users"), orderBy("pixelCached", "desc"), limit(10))
    );
    leaderboard = leaderboardSnap.docs.map((docSnap) => {
      const data = docSnap.data() as UserDocument;
      const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Member";
      return {
        id: docSnap.id,
        name,
        pixels: data.pixelCached ?? data.pixels ?? 0,
      };
    });
  }

  const name = `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Member";
  const rankIndex = leaderboard.findIndex((row) => row.id === userId);
  const rank = rankIndex >= 0 ? rankIndex + 1 : undefined;

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
    activities,
    currentSemesterId: currentSemesterId ?? null,
    rank,
  };
}
