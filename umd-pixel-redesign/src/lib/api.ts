import {
  Timestamp,
  addDoc,
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

export type EventRecord = {
  id: string;
  name: string;
  date: string;
  type: string;
  pixels: number;
  attendeesCount: number;
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

  eventsSnap.forEach((d) => {
    const data = d.data() as any;
    const dateVal = data.date?.toDate ? data.date.toDate() : new Date(data.date || Date.now());
    const name = data.name || data.eventName || "Event";
    events.push({
      id: d.id,
      name,
      date: dateVal.toISOString(),
      type: data.type || "GBM",
      pixels: data.pixels || 0,
      attendeesCount: Array.isArray(data.attendees) ? data.attendees.length : 0,
    });
    eventNameMap.set(d.id, name);
  });

  const excusedSnap = await getDocs(
    query(collectionGroup(db, "excused_absences"), orderBy("createdAt", "desc"))
  );

  const excused: ExcusedRequest[] = [];
  const userIds = new Set<string>();
  excusedSnap.forEach((d) => {
    const data = d.data() as any;
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

  if (userIds.size > 0) {
    await Promise.all(
      Array.from(userIds).map(async (uid) => {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Member";
          const email = data.email || data.slackEmail || "";
          excused.forEach((row) => {
            if (row.userId === uid) {
              row.userName = name;
              row.userEmail = email;
            }
          });
        }
      })
    );
  }

  return { events, excused, currentSemesterId };
}

export async function createEvent(input: EventInput, semesterId: string | null) {
  const dateValue = input.date ? Timestamp.fromDate(new Date(input.date)) : Timestamp.now();
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
    date: dateValue.toISOString(),
    type: newEvent.type,
    pixels: newEvent.pixels,
    attendeesCount: 0,
  } as EventRecord;
}

export async function updateEvent(eventId: string, input: EventInput) {
  const dateValue = input.date ? Timestamp.fromDate(new Date(input.date)) : Timestamp.now();
  await updateDoc(doc(db, "events", eventId), {
    name: input.name,
    type: input.type,
    pixels: Number(input.pixels) || 0,
    date: dateValue,
  });
  return {
    id: eventId,
    name: input.name,
    date: dateValue.toISOString(),
    type: input.type,
    pixels: Number(input.pixels) || 0,
  };
}

export async function deleteEventById(eventId: string) {
  await deleteDoc(doc(db, "events", eventId));
}

export async function updateExcusedStatus(eventId: string, requestId: string, status: string) {
  await updateDoc(doc(db, "events", eventId, "excused_absences", requestId), { status });
}
