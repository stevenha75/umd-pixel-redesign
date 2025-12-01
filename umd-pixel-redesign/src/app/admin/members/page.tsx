"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from "chart.js";
import { CsvExportButton } from "@/components/export/CsvExportButton";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/context/AuthContext";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);
import { useQuery } from "@tanstack/react-query";
import {
  MemberRecord,
  fetchMembers,
  deleteMember,
  fetchAdminData,
  addAttendee,
  setAttendanceStatus,
  fetchSlackUsers,
  addSlackMember,
  SlackUser,
  setPixelDelta,
  recalculateUserPixels,
} from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function MembersPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"pixels" | "name">("pixels");
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [eventTarget, setEventTarget] = useState("");
  const [eventTargetSearch, setEventTargetSearch] = useState("");
  const [memberPage, setMemberPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pixelDeltaInput, setPixelDeltaInput] = useState<string>("");

  // Slack State
  const [slackOpen, setSlackOpen] = useState(false);
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [slackSearch, setSlackSearch] = useState("");
  const [loadingSlack, setLoadingSlack] = useState(false);

  const membersQuery = useQuery<MemberRecord[]>({ queryKey: ["members"], queryFn: fetchMembers });
  const adminQuery = useQuery({
    queryKey: ["admin-data", user?.uid],
    queryFn: fetchAdminData,
    enabled: !!user,
  });
  const EVENT_SUGGESTION_LIMIT = 8;
  const eventSuggestions = useMemo(() => {
    const events = adminQuery.data?.events || [];
    const term = eventTargetSearch.trim().toLowerCase();
    if (!term) return events.slice(0, EVENT_SUGGESTION_LIMIT);
    return events
      .filter((evt) => evt.name.toLowerCase().includes(term))
      .slice(0, EVENT_SUGGESTION_LIMIT);
  }, [adminQuery.data?.events, eventTargetSearch]);
  const MEMBERS_PAGE_SIZE = 15;

  useEffect(() => {
    if (!eventTarget) return;
    const matched = (adminQuery.data?.events || []).find((evt) => evt.id === eventTarget);
    if (matched) setEventTargetSearch(matched.name);
  }, [eventTarget, adminQuery.data?.events]);

  const members = useMemo(() => {
    const data = membersQuery.data || [];
    const filtered = data.filter((m) => {
      const term = search.toLowerCase();
      return (
        m.firstName.toLowerCase().includes(term) ||
        m.lastName.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term)
      );
    });
    filtered.sort((a, b) => {
      if (sort === "pixels") return (b.pixels || 0) - (a.pixels || 0);
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
    return filtered;
  }, [membersQuery.data, search, sort]);
  const totalMemberPages = Math.max(1, Math.ceil(members.length / MEMBERS_PAGE_SIZE));
  const currentMemberPage = Math.min(memberPage, totalMemberPages - 1);
  const pagedMembers = useMemo(() => {
    const start = currentMemberPage * MEMBERS_PAGE_SIZE;
    return members.slice(start, start + MEMBERS_PAGE_SIZE);
  }, [currentMemberPage, members]);

  useEffect(() => {
    setMemberPage(0);
  }, [search, sort, members.length]);

  useEffect(() => {
    const current = members.find((m) => m.id === editing?.id);
    setPixelDeltaInput(
      current?.pixelDelta === undefined || current?.pixelDelta === null
        ? ""
        : String(current.pixelDelta)
    );
  }, [editing, members]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(members.map((m) => m.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const handleDeleteSelected = async () => {
    setSaving(true);
    try {
      await Promise.all(Array.from(selected).map((id) => deleteMember(id)));
      clearSelection();
      await membersQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleAddToEvent = async () => {
    if (!eventTarget || selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(Array.from(selected).map((id) => addAttendee(eventTarget, id)));
      setMessage("Added to event.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlackUser = async (user: SlackUser) => {
      setSaving(true);
      try {
          await addSlackMember(user);
          await membersQuery.refetch();
          setSlackOpen(false);
          setMessage("Member added successfully.");
      } catch (error) {
          console.error(error);
          setMessage(error instanceof Error ? error.message : "Failed to add member.");
      } finally {
          setSaving(false);
      }
  };

  const handleSavePixelDelta = async () => {
    if (!selectedMember) return;
    setSaving(true);
    try {
      const value = pixelDeltaInput.trim() === "" ? 0 : Number(pixelDeltaInput);
      const semesterId = adminQuery.data?.currentSemesterId || null;
      await setPixelDelta(selectedMember.id, value, semesterId);
      await recalculateUserPixels(selectedMember.id);
      await membersQuery.refetch();
      setMessage("Pixel adjustment saved.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to save adjustment.");
    } finally {
      setSaving(false);
    }
  };

  const loadSlackUsers = useCallback(async () => {
    if (slackUsers.length > 0) return;
    setLoadingSlack(true);
    try {
      const users = await fetchSlackUsers();
      setSlackUsers(users);
    } catch (e) {
      console.error(e);
      setMessage("Failed to load Slack users. Check configuration.");
    } finally {
      setLoadingSlack(false);
    }
  }, [slackUsers.length]);

  useEffect(() => {
    if (loadingSlack || slackUsers.length > 0) return;
    void loadSlackUsers();
  }, [loadingSlack, slackUsers.length, loadSlackUsers]);

  const filteredSlackUsers = useMemo(() => {
      const term = slackSearch.toLowerCase();
      return slackUsers.filter(u => 
          (u.real_name || "").toLowerCase().includes(term) ||
          (u.name || "").toLowerCase().includes(term) ||
          (u.email || "").toLowerCase().includes(term)
      );
  }, [slackUsers, slackSearch]);

  const visibleSlackUsers = useMemo(() => {
      return filteredSlackUsers.slice(0, 50);
  }, [filteredSlackUsers]);


  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const selectedMember = members.find((m) => m.id === editing?.id);
  const memberEvents = useMemo(() => {
    if (!selectedMember || !adminQuery.data) return [];
    return adminQuery.data.events.map((evt) => {
      const excused = adminQuery.data?.excused.find(
        (ex) => ex.eventId === evt.id && ex.userId === selectedMember.id && ex.status === "approved"
      );
      const present = evt.attendees.some((a) => a.id === selectedMember.id);
      let status: "Present" | "Excused" | "Unexcused" | "Not Present" = "Not Present";
      if (present) status = "Present";
      else if (excused) status = "Excused";
      else if (["GBM", "other_mandatory"].includes(evt.type)) status = "Unexcused";
      return {
        id: evt.id,
        name: evt.name,
        date: evt.date,
        type: evt.type,
        status,
        pixels: evt.pixels,
      };
    });
  }, [selectedMember, adminQuery.data]);

  const cycleStatus = async (evtId: string, current: string, type: string) => {
    if (!selectedMember) return;
    const mandatory = ["GBM", "other_mandatory"].includes(type);
    let next: "present" | "excused" | "absent" = "present";
    if (current === "Present") next = mandatory ? "excused" : "absent";
    else if (current === "Excused") next = "absent";
    else next = "present";
    setSaving(true);
    setMessage(null);
    try {
      await setAttendanceStatus(evtId, selectedMember.id, next);
      await adminQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout>
        <div className="flex flex-col gap-6 pb-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Members</h1>
            <p className="text-sm text-muted-foreground">
              Manage members, edit profiles, and add attendance.
            </p>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  {membersQuery.isLoading ? (
                    <LoadingState variant="inline" title="Loading members…" />
                  ) : (
                    `${members.length} members`
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <Input
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="md:w-64"
                />
                <Select value={sort} onValueChange={(v) => setSort(v as "pixels" | "name")}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pixels">Pixels</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
                <CsvExportButton
                  filename="members.csv"
                  rows={members.map((m) => ({
                    name: `${m.firstName} ${m.lastName}`,
                    email: m.email,
                    pixels: m.pixels,
                    rank: m.rank ?? "",
                  }))}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Button variant="outline" onClick={selectAll}>
                  Select all
                </Button>
                <Button variant="outline" onClick={clearSelection}>
                  Clear
                </Button>
                <span className="text-muted-foreground">{selected.size} selected</span>
                <div className="relative w-64">
                  <p className="text-xs text-muted-foreground pb-1">
                    Type to search events (suggestions capped).
                  </p>
                  <Input
                    value={eventTargetSearch}
                    onChange={(e) => {
                      setEventTargetSearch(e.target.value);
                      setEventTarget("");
                    }}
                    placeholder="Search events to add"
                  />
                  {eventTargetSearch.trim().length > 0 && (
                    <div className="absolute z-10 mt-2 w-full rounded-md border bg-background shadow-sm">
                      {eventSuggestions.map((evt) => (
                        <button
                          key={evt.id}
                          className="w-full px-3 py-2 text-left hover:bg-muted"
                          onClick={() => {
                            setEventTarget(evt.id);
                            setEventTargetSearch(evt.name);
                          }}
                          type="button"
                        >
                          <div className="text-sm text-foreground">{evt.name}</div>
                          <div className="text-xs text-muted-foreground">{evt.date}</div>
                        </button>
                      ))}
                      {!eventSuggestions.length && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
                      )}
                    </div>
                  )}
                </div>
                <Button onClick={handleAddToEvent} disabled={saving || selected.size === 0 || !eventTarget}>
                  Add to event
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  disabled={saving || selected.size === 0}
                >
                  Delete selected
                </Button>
                {message && <span className="text-muted-foreground">{message}</span>}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Checkbox
                          checked={selected.size === members.length && members.length > 0}
                          onCheckedChange={(v) => (v ? selectAll() : clearSelection())}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Pixels</TableHead>
                      <TableHead className="text-right">Rank</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedMembers.map((m) => (
                      <TableRow
                        key={m.id}
                        className="cursor-pointer"
                        onClick={() => setEditing(m)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selected.has(m.id)}
                            onCheckedChange={() => toggleSelect(m.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="text-foreground">{`${m.firstName} ${m.lastName}`}</TableCell>
                        <TableCell className="text-muted-foreground">{m.email}</TableCell>
                        <TableCell className="text-right text-foreground">{m.pixels}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{m.rank}</TableCell>
                      </TableRow>
                    ))}
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                          No members found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {members.length > MEMBERS_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMemberPage((p) => Math.max(0, p - 1))}
                    disabled={currentMemberPage === 0}
                  >
                    Prev
                  </Button>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    Page {currentMemberPage + 1} of {totalMemberPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMemberPage((p) => Math.min(totalMemberPages - 1, p + 1))}
                    disabled={currentMemberPage >= totalMemberPages - 1}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 items-start">
            <Card className="self-start">
              <CardHeader>
                <CardTitle>Add Member</CardTitle>
                <CardDescription>Import a member from the Slack workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                  <Dialog open={slackOpen} onOpenChange={(open) => {
                      setSlackOpen(open);
                      if (open) loadSlackUsers();
                  }}>
                      <DialogTrigger asChild>
                          <Button variant="outline" className="w-full h-12 justify-start px-4 text-left font-normal">
                              <div className="flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-slack"><rect width="3" height="8" x="13" y="2" rx="1.5"/><path d="M19 8.5V10h1.5A1.5 1.5 0 1 0 19 8.5"/><rect width="3" height="8" x="8" y="14" rx="1.5"/><path d="M5 15.5V14H3.5A1.5 1.5 0 1 0 5 15.5"/><rect width="8" height="3" x="14" y="13" rx="1.5"/><path d="M15.5 19H14v1.5a1.5 1.5 0 1 0 1.5-1.5"/><rect width="8" height="3" x="2" y="8" rx="1.5"/><path d="M8.5 5H10V3.5A1.5 1.5 0 1 0 8.5 5"/></svg>
                                  <div className="flex flex-col items-start">
                                      <span className="text-sm font-medium text-foreground">Select from Slack</span>
                                      <span className="text-xs text-muted-foreground">Search workspace members</span>
                                  </div>
                              </div>
                          </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md h-[600px] flex flex-col">
                          <DialogHeader>
                              <DialogTitle>Select Slack Member</DialogTitle>
                              <DialogDescription>
                                  Search for a user in the Slack workspace to add them to the database.
                              </DialogDescription>
                          </DialogHeader>
                          <div className="flex flex-col gap-4 flex-1 min-h-0 py-2">
                              <Input 
                                  placeholder="Search by name or email..." 
                                  value={slackSearch}
                                  onChange={e => setSlackSearch(e.target.value)}
                                  autoFocus
                              />
                              <div className="flex-1 overflow-y-auto border rounded-md">
                                  {loadingSlack ? (
                                      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
                                          <LoadingState variant="inline" title="Loading Slack users..." />
                                      </div>
                                  ) : (
                                      <div className="divide-y">
                                          {visibleSlackUsers.map(u => {
                                              const exists = members.some(m => m.email === u.email || m.slackId === u.id);
                                              return (
                                                  <div 
                                                      key={u.id} 
                                                      className={`flex items-center gap-3 p-3 transition-colors ${exists ? 'opacity-50 bg-muted/50' : 'hover:bg-muted/50 cursor-pointer'}`}
                                                      onClick={() => !exists && handleAddSlackUser(u)}
                                                  >
                                                      <Avatar className="h-9 w-9 border">
                                                          <AvatarImage src={u.image_original} />
                                                          <AvatarFallback>{(u.real_name || u.name).substring(0, 2).toUpperCase()}</AvatarFallback>
                                                      </Avatar>
                                                      <div className="flex-1 overflow-hidden">
                                                          <div className="font-medium truncate text-sm">{u.real_name || u.name}</div>
                                                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                                                      </div>
                                                      {exists ? (
                                                          <Badge variant="outline" className="text-[10px]">Added</Badge>
                                                      ) : (
                                                          <Button size="sm" variant="ghost" className="h-7 px-2">Add</Button>
                                                      )}
                                                  </div>
                                              );
                                          })}
                                          {filteredSlackUsers.length === 0 && !loadingSlack && (
                                              <div className="p-4 text-center text-sm text-muted-foreground">
                                                  No users found matching &quot;{slackSearch}&quot;.
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </DialogContent>
                  </Dialog>
              </CardContent>
            </Card>


            <Card>
              <CardHeader>
                <CardTitle>Member Info</CardTitle>
                <CardDescription>Edit profile and view attendance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedMember ? (
                  <>
                    <div className="rounded-md border bg-muted/40 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Selected member
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {selectedMember.firstName} {selectedMember.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">{selectedMember.email}</div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          Pixels: {selectedMember.pixels} (Delta {selectedMember.pixelDelta})
                        </span>
                        <div className="relative group">
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-muted"
                            aria-label="Pixel adjustment help"
                          >
                            ?
                          </button>
                          <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-foreground shadow group-hover:block">
                            Adds or subtracts on top of earned pixels for this semester.
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                        <Input
                          type="number"
                          value={pixelDeltaInput}
                          onChange={(e) => setPixelDeltaInput(e.target.value)}
                          placeholder="Pixel adjustment"
                          className="sm:w-44"
                        />
                        <Button onClick={handleSavePixelDelta} disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                    <div className="pt-4">
                      <div className="text-sm font-semibold text-foreground">Events</div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Pixels</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {memberEvents.map((evt) => (
                              <TableRow key={evt.id}>
                                <TableCell>{evt.name}</TableCell>
                                <TableCell className="text-muted-foreground">{evt.date}</TableCell>
                                <TableCell className="text-muted-foreground">{evt.type}</TableCell>
                                <TableCell className="text-muted-foreground">{evt.status}</TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {evt.pixels}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => cycleStatus(evt.id, evt.status, evt.type)}
                                    disabled={saving}
                                  >
                                    Toggle status
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {memberEvents.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">
                                  No events yet.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a member to edit.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
