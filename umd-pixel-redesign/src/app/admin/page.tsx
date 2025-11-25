"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import {
  Timestamp,
  addDoc,
  collection,
  collectionGroup,
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

type ExcusedRow = {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  eventName: string;
  reason: string;
  status: string;
};

const defaultEvent = {
  name: "",
  date: "",
  type: "GBM",
  pixels: 0,
};

export default function AdminPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [excused, setExcused] = useState<ExcusedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultEvent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await refreshEvents(true);
      } catch (err) {
        console.error(err);
        setMessage("Could not load events.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const resetForm = () => {
    setForm(defaultEvent);
    setEditingId(null);
    setErrors({});
  };

  const onChange = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!form.date) nextErrors.date = "Date/time is required.";
    if (form.pixels < 0) nextErrors.pixels = "Pixels cannot be negative.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const createEvent = async () => {
    if (!validateForm()) return;
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
      resetForm();
      setMessage("Event created.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to create event.");
    } finally {
      setSaving(false);
    }
  };

  const refreshEvents = async (initial = false) => {
    if (!initial) {
      setSaving(true);
      setMessage(null);
    }
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
      const excusedSnap = await getDocs(
        query(collectionGroup(db, "excused_absences"), orderBy("createdAt", "desc"))
      );
      const excusedRows: ExcusedRow[] = [];
      const eventNameMap = new Map<string, string>();
      rows.forEach((evt) => eventNameMap.set(evt.id, evt.name));

      excusedSnap.forEach((d) => {
        const data = d.data() as any;
        excusedRows.push({
          id: d.id,
          eventId: d.ref.parent.parent?.id || "",
          eventName: eventNameMap.get(d.ref.parent.parent?.id || "") || "Event",
          userId: data.userId || "",
          userName: "",
          userEmail: "",
          reason: data.reason || "",
          status: data.status || "pending",
        });
      });
      await enrichUsers(excusedRows);
      setExcused(excusedRows);
      if (!initial) setMessage("Refreshed events.");
    } catch (err) {
      console.error(err);
      if (!initial) setMessage("Failed to refresh events.");
    } finally {
      if (!initial) setSaving(false);
    }
  };

  const updateExcusedStatus = async (row: ExcusedRow, status: "approved" | "rejected") => {
    setSaving(true);
    setMessage(null);
    try {
      const parentRef = doc(db, "events", row.eventId, "excused_absences", row.id);
      await updateDoc(parentRef, { status });
      setExcused((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status } : r))
      );
      setMessage(`Marked as ${status}.`);
    } catch (err) {
      console.error(err);
      setMessage("Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const enrichUsers = async (rows: ExcusedRow[]) => {
    const uniqueIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
    await Promise.all(
      uniqueIds.map(async (uid) => {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Member";
          const email = data.email || data.slackEmail || "";
          rows.forEach((r) => {
            if (r.userId === uid) {
              r.userName = name;
              r.userEmail = email;
            }
          });
        }
      })
    );
  };

  const startEdit = (evt: EventRow) => {
    setEditingId(evt.id);
    setForm({
      name: evt.name,
      date: new Date(evt.date).toISOString().slice(0, 16),
      type: evt.type,
      pixels: evt.pixels,
    });
    setErrors({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!validateForm()) return;
    setSaving(true);
    setMessage(null);
    try {
      const dateValue = form.date ? Timestamp.fromDate(new Date(form.date)) : Timestamp.now();
      await updateDoc(doc(db, "events", editingId), {
        name: form.name,
        type: form.type,
        pixels: Number(form.pixels) || 0,
        date: dateValue,
      });
      setEvents((prev) =>
        prev.map((evt) =>
          evt.id === editingId
            ? {
                ...evt,
                name: form.name,
                type: form.type,
                pixels: Number(form.pixels) || 0,
                date: dateValue.toDate().toLocaleDateString(),
              }
            : evt
        )
      );
      resetForm();
      setMessage("Event updated.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to update event.");
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
                {errors.name && <span className="text-xs text-rose-600">{errors.name}</span>}
              </label>
              <label className="flex flex-col gap-2 text-sm text-zinc-700">
                Date
                <input
                  type="datetime-local"
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                  value={form.date}
                  onChange={(e) => onChange("date", e.target.value)}
                />
                {errors.date && <span className="text-xs text-rose-600">{errors.date}</span>}
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
                {errors.pixels && <span className="text-xs text-rose-600">{errors.pixels}</span>}
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={editingId ? saveEdit : createEvent}
                disabled={saving}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create event"}
              </button>
              {editingId && (
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => refreshEvents()}
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
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
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
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => startEdit(evt)}
                            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                          No events yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">Excused Absences</h2>
              <span className="text-sm text-zinc-500">
                {excused.filter((r) => r.status === "pending").length} pending
              </span>
            </div>
            {loading ? (
              <p className="text-sm text-zinc-600">Loading requests…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">User</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {excused.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 text-zinc-900">{row.eventName || row.eventId}</td>
                        <td className="px-3 py-2 text-zinc-700">{row.userName || row.userId}</td>
                        <td className="px-3 py-2 text-zinc-700">{row.userEmail}</td>
                        <td className="px-3 py-2 text-zinc-700">{row.reason}</td>
                        <td className="px-3 py-2 text-zinc-700 capitalize">{row.status}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => updateExcusedStatus(row, "approved")}
                              disabled={row.status === "approved" || saving}
                              className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateExcusedStatus(row, "rejected")}
                              disabled={row.status === "rejected" || saving}
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {excused.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                          No excused absence requests yet.
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
