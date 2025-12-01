"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
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
import { CsvExportButton } from "@/components/export/CsvExportButton";
import {
  AdminData,
  EventInput,
  createEvent as createEventApi,
  deleteEventById,
  fetchAdminData,
  updateEvent as updateEventApi,
  updateEventPixels,
  updateExcusedStatus as apiUpdateExcusedStatus,
  addAttendee,
  removeAttendee,
  addAttendeesByEmail,
  findUserIdByEmail,
  fetchMembers,
  MemberRecord,
} from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";

type EventRow = {
  id: string;
  name: string;
  date: string;
  type: string;
  pixels: number;
  attendeesCount: number;
  attendees: {
    id: string;
    name: string;
    email: string;
  }[];
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
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [excused, setExcused] = useState<ExcusedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"date" | "name" | "pixels">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentSemesterId, setCurrentSemesterId] = useState<string | null>(null);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [attendeeMemberSearch, setAttendeeMemberSearch] = useState("");
  const [attendeeMemberSuggestions, setAttendeeMemberSuggestions] = useState<MemberRecord[]>([]);
  const [attendeeEmails, setAttendeeEmails] = useState("");
  const [attendeeEventId, setAttendeeEventId] = useState<string | null>(null);
  const [attendeeEventSearch, setAttendeeEventSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [bulkPixels, setBulkPixels] = useState<number | "">("");
  const [eventPage, setEventPage] = useState(0);
  const EVENTS_PAGE_SIZE = 20;

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
    setValue,
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: defaultEvent,
  });

  const membersQuery = useQuery<MemberRecord[]>({
    queryKey: ["members"],
    queryFn: fetchMembers,
    staleTime: 60_000,
  });

  const adminQuery = useQuery<AdminData>({
    queryKey: ["admin-data", user?.uid],
    queryFn: fetchAdminData,
    staleTime: 60_000,
    enabled: !!user,
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

  const handleAddAttendee = async () => {
    if (!attendeeEventId || !attendeeInput.trim()) return;

    // Check if already added locally first
    const currentEvent = events.find((e) => e.id === attendeeEventId);
    if (!currentEvent) return;

    setSaving(true);
    setMessage(null);
    try {
      const rawInput = attendeeInput.trim();
      const userId = rawInput.includes("@") ? await findUserIdByEmail(rawInput) : rawInput;
      
      if (!userId) {
        setMessage("User not found for that email.");
        return;
      }

      if (currentEvent.attendees.some((a) => a.id === userId)) {
        setMessage("User is already an attendee.");
        return;
      }

      await addAttendee(attendeeEventId, userId);
      setEvents((prev) =>
        prev.map((evt) =>
          evt.id === attendeeEventId
            ? {
                ...evt,
                attendeesCount: evt.attendeesCount + 1,
                attendees: [
                  ...evt.attendees,
                  { id: userId, name: userId, email: rawInput.includes("@") ? rawInput : "" },
                ],
              }
            : evt
        )
      );
      setAttendeeInput("");
      setAttendeeMemberSearch("");
      setAttendeeMemberSuggestions([]);
      setAttendeeEventId(null);
      setMessage("Attendee added.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to add attendee.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAttendeesByEmail = async () => {
    if (!attendeeEventId || !attendeeEmails.trim()) return;

    const currentEvent = events.find((e) => e.id === attendeeEventId);
    if (!currentEvent) return;

    setSaving(true);
    setMessage(null);
    try {
      const emails = attendeeEmails
        .replace(/\n/g, " ")
        .split(/[ ,]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      const foundIds = await addAttendeesByEmail(attendeeEventId, emails);
      
      const newIds = foundIds.filter(
        (id) => !currentEvent.attendees.some((existing) => existing.id === id)
      );

      if (newIds.length === 0) {
        setMessage("All users were already attendees.");
      } else {
        setEvents((prev) =>
          prev.map((evt) =>
            evt.id === attendeeEventId
              ? {
                  ...evt,
                  attendeesCount: evt.attendeesCount + newIds.length,
                  attendees: [
                    ...evt.attendees,
                    ...newIds.map((id) => ({ id, name: id, email: "" })),
                  ],
                }
              : evt
          )
        );
        setAttendeeEmails("");
        setMessage(`Added ${newIds.length} new attendees.`);
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to add attendees by email.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAttendee = async (eventId: string, userId: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await removeAttendee(eventId, userId);
      setEvents((prev) =>
        prev.map((evt) =>
          evt.id === eventId
            ? {
                ...evt,
                attendeesCount: Math.max(0, evt.attendeesCount - 1),
                attendees: evt.attendees.filter((a) => a.id !== userId),
              }
            : evt
        )
      );
      setMessage("Attendee removed.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to remove attendee.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEventSelection = (id: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const bulkDeleteEvents = async () => {
    if (selectedEvents.size === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      await Promise.all(Array.from(selectedEvents).map((id) => deleteEventById(id)));
      setEvents((prev) => prev.filter((e) => !selectedEvents.has(e.id)));
      setSelectedEvents(new Set());
      setMessage("Events deleted.");
    } catch (err) {
      console.error(err);
      setMessage("Failed bulk delete.");
    } finally {
      setSaving(false);
    }
  };

  const bulkSetPixels = async () => {
    if (selectedEvents.size === 0 || bulkPixels === "") return;
    setSaving(true);
    setMessage(null);
    try {
      await Promise.all(
        Array.from(selectedEvents).map((id) => updateEventPixels(id, Number(bulkPixels)))
      );
      setEvents((prev) =>
        prev.map((evt) =>
          selectedEvents.has(evt.id) ? { ...evt, pixels: Number(bulkPixels) } : evt
        )
      );
      setBulkPixels("");
      setMessage("Pixels updated.");
    } catch (err) {
      console.error(err);
      setMessage("Failed bulk update.");
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
    if (!eventSearch.trim()) return copy;
    const term = eventSearch.toLowerCase();
    return copy.filter(
      (evt) => evt.name.toLowerCase().includes(term) || evt.type.toLowerCase().includes(term)
    );
  }, [events, sortDir, sortKey, eventSearch]);
  const totalEventPages = Math.max(1, Math.ceil(sortedEvents.length / EVENTS_PAGE_SIZE));
  const currentEventPage = Math.min(eventPage, totalEventPages - 1);
  const pagedEvents = useMemo(() => {
    const start = currentEventPage * EVENTS_PAGE_SIZE;
    return sortedEvents.slice(start, start + EVENTS_PAGE_SIZE);
  }, [currentEventPage, sortedEvents]);

  useEffect(() => {
    setEventPage(0);
  }, [eventSearch, sortDir, sortKey, events.length]);
  const EVENT_SUGGESTION_LIMIT = 8;
  useEffect(() => {
    const term = attendeeMemberSearch.trim().toLowerCase();
    if (!term) {
      setAttendeeMemberSuggestions([]);
      return;
    }
    const all = membersQuery.data || [];
    const filtered = all
      .filter(
        (m) =>
          `${m.firstName} ${m.lastName}`.toLowerCase().includes(term) ||
          m.email.toLowerCase().includes(term)
      )
      .slice(0, 5);
    setAttendeeMemberSuggestions(filtered);
  }, [attendeeMemberSearch, membersQuery.data]);
  const attendeeEventSuggestions = useMemo(() => {
    const term = attendeeEventSearch.trim().toLowerCase();
    if (!term) return sortedEvents.slice(0, EVENT_SUGGESTION_LIMIT);
    return sortedEvents
      .filter((evt) => evt.name.toLowerCase().includes(term))
      .slice(0, EVENT_SUGGESTION_LIMIT);
  }, [attendeeEventSearch, sortedEvents]);

  useEffect(() => {
    if (!attendeeEventId) return;
    const matched = sortedEvents.find((evt) => evt.id === attendeeEventId);
    if (matched) setAttendeeEventSearch(matched.name);
  }, [attendeeEventId, sortedEvents]);

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
          {adminQuery.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <div className="font-semibold">Could not load admin data</div>
              <div className="break-all text-xs text-destructive/80">
                {(adminQuery.error as Error).message}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/15">
              Admin workspace
            </div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Manage events, pixels, and attendance. 
            </p>
          </div>

          <Card className="border-primary/10 bg-white/90 shadow-sm backdrop-blur">
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

          <Card className="border-primary/10 bg-white/90 shadow-sm backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Events</CardTitle>
                <CardDescription>Sorted table of events for the current semester.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <Input
                  placeholder="Search events"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="md:w-56"
                />
                <CsvExportButton
                  filename="events.csv"
                  rows={sortedEvents.map((evt) => ({
                    name: evt.name,
                    date: evt.date,
                    type: evt.type,
                    pixels: evt.pixels,
                    attendees: evt.attendeesCount,
                  }))}
                />
                <span className="text-sm text-muted-foreground">{events.length} total</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
                <Input
                  type="number"
                  min={0}
                  value={bulkPixels === "" ? "" : bulkPixels}
                  onChange={(e) =>
                    setBulkPixels(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Set pixels"
                  className="w-32"
                />
                <Button
                  variant="outline"
                  onClick={bulkSetPixels}
                  disabled={saving || selectedEvents.size === 0 || bulkPixels === ""}
                >
                  Apply to selected
                </Button>
                <Button
                  variant="destructive"
                  onClick={bulkDeleteEvents}
                  disabled={saving || selectedEvents.size === 0}
                >
                  Delete selected
                </Button>
              </div>
              {loading ? (
                <LoadingState variant="inline" title="Loading events…" />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                        <TableRow>
                          <TableHead>
                            <Checkbox
                              checked={
                                selectedEvents.size > 0 &&
                                selectedEvents.size === sortedEvents.length
                              }
                              onCheckedChange={(v) =>
                                v
                                  ? setSelectedEvents(new Set(sortedEvents.map((e) => e.id)))
                                  : setSelectedEvents(new Set())
                              }
                            />
                          </TableHead>
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
                        {pagedEvents.map((evt) => (
                          <TableRow key={evt.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedEvents.has(evt.id)}
                                onCheckedChange={() => toggleEventSelection(evt.id)}
                              />
                            </TableCell>
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
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setAttendeeEventId(evt.id);
                                    setAttendeeInput("");
                                  }}
                                >
                                  Manage attendees
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
                  {sortedEvents.length > EVENTS_PAGE_SIZE && (
                    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEventPage((p) => Math.max(0, p - 1))}
                        disabled={currentEventPage === 0}
                      >
                        Prev
                      </Button>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Page {currentEventPage + 1} of {totalEventPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEventPage((p) => Math.min(totalEventPages - 1, p + 1))}
                        disabled={currentEventPage >= totalEventPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-white/90 shadow-sm backdrop-blur">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Excused Absences</CardTitle>
                <CardDescription>Approve or reject requests</CardDescription>
              </div>
              <span className="text-sm text-muted-foreground">
                {excused.filter((r) => r.status === "pending").length} pending
              </span>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingState variant="inline" title="Loading requests…" />
              ) : (
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
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-white/90 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle>Manage Attendees</CardTitle>
              <CardDescription>Add or remove attendees by user ID or email list.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3">
                <div className="relative flex flex-col gap-2 md:w-1/2">
                  <label className="text-sm text-muted-foreground">Member</label>
                  <Input
                    value={attendeeMemberSearch}
                    onChange={(e) => {
                      setAttendeeMemberSearch(e.target.value);
                      setAttendeeInput(e.target.value);
                    }}
                    placeholder="Search member (name or email)"
                  />
                  {attendeeMemberSearch.trim().length > 0 &&
                    attendeeMemberSuggestions.length > 0 &&
                    !attendeeMemberSuggestions.some(
                      (m) => m.email.toLowerCase() === attendeeMemberSearch.trim().toLowerCase()
                    ) && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-md border bg-background shadow-sm">
                        {attendeeMemberSuggestions.map((m) => (
                          <button
                            key={m.id}
                            className="w-full px-3 py-2 text-left hover:bg-muted"
                            onClick={() => {
                              setAttendeeMemberSearch(m.email || `${m.firstName} ${m.lastName}`.trim());
                              setAttendeeInput(m.email || m.id);
                              setAttendeeMemberSuggestions([]);
                            }}
                            type="button"
                          >
                            <div className="text-sm text-foreground">{`${m.firstName} ${m.lastName}`.trim() || "Member"}</div>
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                <div className="relative flex flex-col gap-2 md:w-1/2">
                  <label className="text-sm text-muted-foreground">Event</label>
                  <Input
                    value={attendeeEventSearch}
                    onChange={(e) => {
                      setAttendeeEventSearch(e.target.value);
                      setAttendeeEventId(null);
                    }}
                    placeholder="Search events by name"
                  />
                  {attendeeEventSearch.trim().length > 0 &&
                    !attendeeEventSuggestions.some(
                      (evt) =>
                        evt.name.toLowerCase() === attendeeEventSearch.trim().toLowerCase()
                    ) && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-md border bg-background shadow-sm">
                      {attendeeEventSuggestions.map((evt) => (
                        <button
                          key={evt.id}
                          className="w-full px-3 py-2 text-left hover:bg-muted"
                          onClick={() => {
                            setAttendeeEventId(evt.id);
                            setAttendeeEventSearch(evt.name);
                          }}
                          type="button"
                        >
                          <div className="text-sm text-foreground">{evt.name}</div>
                          <div className="text-xs text-muted-foreground">{evt.date}</div>
                        </button>
                      ))}
                      {!attendeeEventSuggestions.length && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleAddAttendee}
                    disabled={saving || !attendeeInput || !attendeeEventId}
                  >
                    Add attendee
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">
                  Paste emails (space, comma, or newline separated)
                </label>
                <Textarea
                  value={attendeeEmails}
                  onChange={(e) => setAttendeeEmails(e.target.value)}
                  placeholder="email1@domain.com email2@domain.com"
                  rows={3}
                />
                <Button
                  onClick={handleAddAttendeesByEmail}
                  disabled={saving || !attendeeEventId || !attendeeEmails.trim()}
                >
                  Add by email
                </Button>
              </div>
              {attendeeEventId && (
                <Table>
                  <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events
                        .find((e) => e.id === attendeeEventId)
                        ?.attendees.map((att) => (
                          <TableRow key={att.id}>
                            <TableCell className="text-foreground">{att.name || att.id}</TableCell>
                            <TableCell className="text-muted-foreground">{att.email}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveAttendee(attendeeEventId, att.id)}
                                disabled={saving}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        )) ?? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
                            No attendees yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
