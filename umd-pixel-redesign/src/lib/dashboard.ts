import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
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
  leaderboard: LeaderboardRow[];
  leaderboardEnabled: boolean;
  activities: ActivityRow[];
  rank?: number;
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

  const excusedSnapshot = await getDocs(
    query(
      collectionGroup(db, "excused_absences"),
      where("userId", "==", userId),
      where("status", "==", "approved")
    )
  );
  const excusedEventIds = new Set<string>();
  excusedSnapshot.forEach((doc) => {
    const eventRef = doc.ref.parent.parent;
    if (eventRef) excusedEventIds.add(eventRef.id);
  });

  const eventQuery = currentSemesterId
    ? query(
        collection(db, "events"),
        where("semesterId", "==", currentSemesterId),
        orderBy("date", "desc")
      )
    : query(collection(db, "events"), orderBy("date", "desc"));

  const eventsSnap = await getDocs(eventQuery);
  const pixelLog: PixelLogRow[] = [];
  let earnedPixels = 0;

  eventsSnap.forEach((eventDoc) => {
    const event = eventDoc.data() as EventDocument;
    const attendees: string[] = event.attendees || [];
    const pixels: number = event.pixels || 0;
    const eventDate = toDate(event.date);

    let attendance: PixelLogRow["attendance"] = "No Show";

    if (attendees.includes(userId)) {
      attendance = "Attended";
    }
    if (excusedEventIds.has(eventDoc.id)) {
      attendance = "Excused";
    }
    if (requiredTypes.includes(event.type) && attendance === "No Show") {
      attendance = "Unexcused";
    }

    const pixelsEarned = attendance === "Attended" && pixels > 0 ? pixels : 0;
    if (pixelsEarned > 0) earnedPixels += pixelsEarned;

    pixelLog.push({
      id: `${eventDoc.id}-${userId}`,
      eventId: eventDoc.id,
      date: eventDate.toLocaleDateString(),
      name: event.name || "Event",
      type: event.type || "event",
      attendance,
      pixelsAllocated: pixels,
      pixelsEarned,
    });
  });

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
      earnedPixels += total;
    }
  });

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
    pixelLog,
    leaderboard,
    leaderboardEnabled,
    activities,
    rank,
  };
}
