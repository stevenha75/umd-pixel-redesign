"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type EventRow = {
  id: string;
  name: string;
  date: string;
  type: string;
  pixels: number;
  attendeesCount: number;
};

const defaultEvent = {
  name: "",
  date: "",
  type: "GBM",
  pixels: 0,
};

export default function AdminPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultEvent);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "global"));
        const currentSemesterId = settingsSnap.data()?.currentSemesterId;
        const q = currentSemesterId
          ? query(collection(db, "events"), orderBy("date", "desc"))
          : query(collection(db, "events"), orderBy("date", "desc"));
        const snap = await getDocs(q);
        const rows: EventRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const date = data.date?.toDate ? data.date.toDate() : new Date(data.date || Date.now());
          rows.push({
            id: d.id,
            name: data.name || data.eventName || "Event",
            date: date.toLocaleDateString(),
            type: data.type || "GBM",
            pixels: data.pixels || 0,
            attendeesCount: Array.isArray(data.attendees) ? data.attendees.length : 0,
          });
        });
        setEvents(rows);
      } catch (err) {
        console.error(err);
        setMessage("Could not load events.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onChange = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const createEvent = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const settingsSnap = await getDoc(doc(db, "settings", "global"));
      const currentSemesterId = settingsSnap.data()?.currentSemesterId;
      const dateValue = form.date ? Timestamp.fromDate(new Date(form.date)) : Timestamp.now();
      const newEvent = {
        name: form.name,
        semesterId: currentSemesterId || "",
        date: dateValue,
        type: form.type,
        pixels: Number(form.pixels) || 0,
        attendees: [],
      };
      const created = await addDoc(collection(db, "events"), newEvent);
      setEvents((prev) => [
        {
          id: created.id,
          name: newEvent.name,
          date: dateValue.toDate().toLocaleDateString(),
          type: newEvent.type,
          pixels: newEvent.pixels,
          attendeesCount: 0,
        },
        ...prev,
      ]);
      setForm(defaultEvent);
      setMessage("Event created.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to create event.");
    } finally {
      setSaving(false);
    }
  };

  const refreshPixels = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const settingsSnap = await getDoc(doc(db, "settings", "global"));
      const currentSemesterId = settingsSnap.data()?.currentSemesterId;
      const q = currentSemesterId
        ? query(collection(db, "events"), orderBy("date", "desc"))
        : query(collection(db, "events"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      const rows: EventRow[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const date = data.date?.toDate ? data.date.toDate() : new Date(data.date || Date.now());
        rows.push({
          id: d.id,
          name: data.name || data.eventName || "Event",
          date: date.toLocaleDateString(),
          type: data.type || "GBM",
          pixels: data.pixels || 0,
          attendeesCount: Array.isArray(data.attendees) ? data.attendees.length : 0,
        });
      });
      setEvents(rows);
      setMessage("Refreshed events.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to refresh events.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <Navbar />
      <main className="bg-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="mb-6 flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-zinc-900">Admin Dashboard</h1>
            <p className="text-sm text-zinc-600">
              Manage events, pixels, and attendance. Mirrors legacy admin flows with a modern UI.
            </p>
          </div>

          <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Create event</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-zinc-700">
                Name
                <input
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                  value={form.name}
                  onChange={(e) => onChange("name", e.target.value)}
                  placeholder="Event name"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-zinc-700">
                Date
                <input
                  type="datetime-local"
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                  value={form.date}
                  onChange={(e) => onChange("date", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-zinc-700">
                Type
                <select
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                  value={form.type}
                  onChange={(e) => onChange("type", e.target.value)}
                >
                  <option value="GBM">GBM</option>
                  <option value="other_mandatory">Other Mandatory</option>
                  <option value="sponsor_event">Sponsor Event</option>
                  <option value="other_prof_dev">Other Professional Development</option>
                  <option value="social">Social</option>
                  <option value="other_optional">Other Optional</option>
                  <option value="pixel_activity">Pixel Activity</option>
                  <option value="special">Special</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm text-zinc-700">
                Pixels
                <input
                  type="number"
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                  value={form.pixels}
                  onChange={(e) => onChange("pixels", Number(e.target.value))}
                  min={0}
                />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={createEvent}
                disabled={saving}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Create event"}
              </button>
              <button
                onClick={refreshPixels}
                disabled={saving}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
              >
                Refresh events
              </button>
              {message && <span className="text-sm text-zinc-600">{message}</span>}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">Events</h2>
              <span className="text-sm text-zinc-500">{events.length} total</span>
            </div>
            {loading ? (
              <p className="text-sm text-zinc-600">Loading events…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium text-right">Pixels</th>
                      <th className="px-3 py-2 font-medium text-right">Attendees</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {events.map((evt) => (
                      <tr key={evt.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 text-zinc-900">{evt.name}</td>
                        <td className="px-3 py-2 text-zinc-700">{evt.date}</td>
                        <td className="px-3 py-2 text-zinc-700">{evt.type}</td>
                        <td className="px-3 py-2 text-right text-zinc-800">{evt.pixels}</td>
                        <td className="px-3 py-2 text-right text-zinc-800">{evt.attendeesCount}</td>
                      </tr>
                    ))}
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                          No events yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
