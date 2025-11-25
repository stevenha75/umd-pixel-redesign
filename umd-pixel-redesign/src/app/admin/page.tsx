"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AdminData,
  EventInput,
  createEvent as createEventApi,
  deleteEventById,
  fetchAdminData,
  updateEvent as updateEventApi,
  updateExcusedStatus as apiUpdateExcusedStatus,
} from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"date" | "name" | "pixels">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentSemesterId, setCurrentSemesterId] = useState<string | null>(null);

  const eventSchema = z.object({
    name: z.string().trim().min(1, "Name is required."),
    date: z.string().trim().min(1, "Date/time is required."),
    type: z.string().trim(),
    pixels: z
      .number({
        invalid_type_error: "Pixels must be a number.",
      })
      .min(0, "Pixels cannot be negative."),
  });

  type EventForm = z.infer<typeof eventSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: defaultEvent,
  });

  const adminQuery = useQuery<AdminData>({
    queryKey: ["admin-data"],
    queryFn: fetchAdminData,
    staleTime: 60_000,
  });

  useEffect(() => {
    setLoading(adminQuery.isLoading);
    if (adminQuery.data) {
      setEvents(adminQuery.data.events);
      setExcused(adminQuery.data.excused);
      setCurrentSemesterId(adminQuery.data.currentSemesterId);
    }
  }, [adminQuery.data, adminQuery.isLoading]);

  const resetForm = () => {
    reset(defaultEvent);
    setEditingId(null);
  };

  const createEvent = async (values: EventForm) => {
    setSaving(true);
    setMessage(null);
    try {
      const created = await createEventApi(values as EventInput, currentSemesterId);
      setEvents((prev) => [
        { ...created, date: new Date(created.date).toLocaleDateString() },
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

  const refreshEvents = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await adminQuery.refetch();
      if (result.data) {
        setEvents(result.data.events);
        setExcused(result.data.excused);
        setCurrentSemesterId(result.data.currentSemesterId);
      }
      setMessage("Refreshed events.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to refresh events.");
    } finally {
      setSaving(false);
    }
  };

  const updateExcusedStatus = async (row: ExcusedRow, status: "approved" | "rejected") => {
    setSaving(true);
    setMessage(null);
    try {
      await apiUpdateExcusedStatus(row.eventId, row.id, status);
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
    setValue("name", evt.name);
    setValue("date", new Date(evt.date).toISOString().slice(0, 16));
    setValue("type", evt.type);
    setValue("pixels", evt.pixels);
  };

  const deleteEvent = async (evt: EventRow) => {
    const confirmed = window.confirm(`Delete event "${evt.name}"?`);
    if (!confirmed) return;
    setSaving(true);
    setMessage(null);
    try {
      await deleteEventById(evt.id);
      setEvents((prev) => prev.filter((e) => e.id !== evt.id));
      setMessage("Event deleted.");
      if (editingId === evt.id) {
        resetForm();
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to delete event.");
    } finally {
      setSaving(false);
    }
  };

  const sortedEvents = useMemo(() => {
    const copy = [...events];
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "pixels") return dir * ((a.pixels || 0) - (b.pixels || 0));
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      return dir * new Date(a.date).getTime() - dir * new Date(b.date).getTime();
    });
    return copy;
  }, [events, sortDir, sortKey]);

  const toggleSort = (key: "date" | "name" | "pixels") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const saveEdit = async (values: EventForm) => {
    if (!editingId) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateEventApi(editingId, values as EventInput);
      const dateValue = updated.date ? new Date(updated.date) : new Date();
      setEvents((prev) =>
        prev.map((evt) =>
          evt.id === editingId
            ? {
                ...evt,
                name: updated.name,
                type: updated.type,
                pixels: updated.pixels,
                date: dateValue.toLocaleDateString(),
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
      <AdminLayout>
        <div className="flex flex-col gap-6 pb-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-zinc-900">Admin Dashboard</h1>
            <p className="text-sm text-zinc-600">
              Manage events, pixels, and attendance. Mirrors legacy admin flows with a modern UI.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit event" : "Create event"}</CardTitle>
              <CardDescription>Manage event metadata and pixel allocation.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={handleSubmit(editingId ? saveEdit : createEvent)}
              >
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground">Name</label>
                  <Input placeholder="Event name" {...register("name")} />
                  {errors.name && (
                    <span className="text-xs text-rose-600">{errors.name.message}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground">Date</label>
                  <Input type="datetime-local" {...register("date")} />
                  {errors.date && (
                    <span className="text-xs text-rose-600">{errors.date.message}</span>
                  )}
                </div>
                <Controller
                  name="type"
                  control={control}
                  defaultValue="GBM"
                  render={({ field }) => (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-muted-foreground">Type</label>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBM">GBM</SelectItem>
                          <SelectItem value="other_mandatory">Other Mandatory</SelectItem>
                          <SelectItem value="sponsor_event">Sponsor Event</SelectItem>
                          <SelectItem value="other_prof_dev">
                            Other Professional Development
                          </SelectItem>
                          <SelectItem value="social">Social</SelectItem>
                          <SelectItem value="other_optional">Other Optional</SelectItem>
                          <SelectItem value="pixel_activity">Pixel Activity</SelectItem>
                          <SelectItem value="special">Special</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground">Pixels</label>
                  <Input type="number" min={0} {...register("pixels", { valueAsNumber: true })} />
                  {errors.pixels && (
                    <span className="text-xs text-rose-600">{errors.pixels.message}</span>
                  )}
                </div>
                <div className="col-span-full mt-2 flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : editingId ? "Save changes" : "Create event"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => refreshEvents()}
                    disabled={saving}
                  >
                    Refresh events
                  </Button>
                  {message && <span className="text-sm text-muted-foreground">{message}</span>}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Events</CardTitle>
                <CardDescription>Sorted table of events for the current semester.</CardDescription>
              </div>
              <span className="text-sm text-muted-foreground">{events.length} total</span>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading events…</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button
                            onClick={() => toggleSort("name")}
                            className="flex items-center gap-1"
                            title="Sort by name"
                          >
                            Name {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => toggleSort("date")}
                            className="flex items-center gap-1"
                            title="Sort by date"
                          >
                            Date {sortKey === "date" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                          </button>
                        </TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => toggleSort("pixels")}
                            className="flex w-full items-center justify-end gap-1"
                            title="Sort by pixels"
                          >
                            Pixels {sortKey === "pixels" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">Attendees</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedEvents.map((evt) => (
                        <TableRow key={evt.id}>
                          <TableCell className="text-foreground">{evt.name}</TableCell>
                          <TableCell className="text-muted-foreground">{evt.date}</TableCell>
                          <TableCell className="text-muted-foreground">{evt.type}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {evt.pixels}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {evt.attendeesCount}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(evt)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteEvent(evt)}
                                disabled={saving}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {events.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                            No events yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Excused Absences</CardTitle>
                <CardDescription>Approve or reject requests; matches legacy behavior.</CardDescription>
              </div>
              <span className="text-sm text-muted-foreground">
                {excused.filter((r) => r.status === "pending").length} pending
              </span>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading requests…</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {excused.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-foreground">{row.eventName || row.eventId}</TableCell>
                          <TableCell className="text-muted-foreground">{row.userName || row.userId}</TableCell>
                          <TableCell className="text-muted-foreground">{row.userEmail}</TableCell>
                          <TableCell className="text-muted-foreground">{row.reason}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{row.status}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateExcusedStatus(row, "approved")}
                                disabled={row.status === "approved" || saving}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateExcusedStatus(row, "rejected")}
                                disabled={row.status === "rejected" || saving}
                                className="border-rose-200 text-rose-800 hover:bg-rose-50"
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {excused.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                            No excused absence requests yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </ProtectedRoute>
  );
}
