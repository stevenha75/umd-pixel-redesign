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
  fetchActivities,
  setActivityMultiplier,
  ActivityRecord,
} from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown } from "lucide-react";

export default function MembersPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"pixels" | "name">("pixels");
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [eventTarget, setEventTarget] = useState("");
  const [eventTargetSearch, setEventTargetSearch] = useState("");
  const [activityTarget, setActivityTarget] = useState("");
  const [activityTargetSearch, setActivityTargetSearch] = useState("");
  const [memberPage, setMemberPage] = useState(0);
  const [memberEventsPage, setMemberEventsPage] = useState(0);
  const [memberEventsSearch, setMemberEventsSearch] = useState("");
  const [memberActivitiesPage, setMemberActivitiesPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pixelDeltaInput, setPixelDeltaInput] = useState<string>("");

  // Slack State
  const [slackOpen, setSlackOpen] = useState(false);
  const [addToEventOpen, setAddToEventOpen] = useState(false);
  const [addToActivityOpen, setAddToActivityOpen] = useState(false);
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [slackSearch, setSlackSearch] = useState("");
  const [selectedSlackUsers, setSelectedSlackUsers] = useState<Set<string>>(new Set());
  const [loadingSlack, setLoadingSlack] = useState(false);

  const membersQuery = useQuery<MemberRecord[]>({ queryKey: ["members"], queryFn: fetchMembers });
  const adminQuery = useQuery({
    queryKey: ["admin-data", user?.uid],
    queryFn: fetchAdminData,
    enabled: !!user,
  });
  const activitiesQuery = useQuery({
      queryKey: ["activities", adminQuery.data?.currentSemesterId],
      queryFn: () => fetchActivities(adminQuery.data?.currentSemesterId || undefined),
      enabled: !!adminQuery.data?.currentSemesterId
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

  const ACTIVITY_SUGGESTION_LIMIT = 8;
  const activitySuggestions = useMemo(() => {
      const activities = activitiesQuery.data || [];
      const term = activityTargetSearch.trim().toLowerCase();
      if (!term) return activities.slice(0, ACTIVITY_SUGGESTION_LIMIT);
      return activities
          .filter((act) => act.name.toLowerCase().includes(term))
          .slice(0, ACTIVITY_SUGGESTION_LIMIT);
  }, [activitiesQuery.data, activityTargetSearch]);

  const MEMBERS_PAGE_SIZE = 15;

  useEffect(() => {
    if (!eventTarget) return;
    const matched = (adminQuery.data?.events || []).find((evt) => evt.id === eventTarget);
    if (matched) setEventTargetSearch(matched.name);
  }, [eventTarget, adminQuery.data?.events]);

  useEffect(() => {
      if (!activityTarget) return;
      const matched = (activitiesQuery.data || []).find((act) => act.id === activityTarget);
      if (matched) setActivityTargetSearch(matched.name);
  }, [activityTarget, activitiesQuery.data]);

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

  const handleAddToActivity = async () => {
      if (!activityTarget || selected.size === 0) return;
      setSaving(true);
      try {
          await Promise.all(Array.from(selected).map((id) => setActivityMultiplier(activityTarget, id, 1)));
          setMessage("Added to activity.");
          await membersQuery.refetch();
      } catch (e) {
          console.error(e);
          setMessage("Failed to add to activity.");
      } finally {
          setSaving(false);
      }
  };

  const handleAddSelectedSlackUsers = async () => {
      const usersToAdd = slackUsers.filter((u) => selectedSlackUsers.has(u.id));
      if (usersToAdd.length === 0) return;

      setSaving(true);
      try {
          const results = await Promise.allSettled(usersToAdd.map((u) => addSlackMember(u)));
          await membersQuery.refetch();
          
          const succeeded = results.filter((r) => r.status === "fulfilled").length;
          const failed = results.filter((r) => r.status === "rejected").length;
          
          // Keep only failed users in selection so they can be retried
          const failedUserIdsToKeep = new Set(
            results
              .map((r, idx) => (r.status === "rejected" ? usersToAdd[idx].id : null))
              .filter(Boolean) as string[]
          );
          setSelectedSlackUsers(new Set([...selectedSlackUsers].filter((id) => failedUserIdsToKeep.has(id))));
          
          if (failed === 0) {
            setSlackOpen(false);
            setMessage(
              succeeded === 1
                ? "1 member added successfully."
                : `${succeeded} members added successfully.`
            );
          } else if (succeeded === 0) {
            setMessage(
              failed === 1
                ? "Failed to add member."
                : `Failed to add ${failed} members.`
            );
          } else {
            setMessage(
              `${succeeded} member${succeeded === 1 ? "" : "s"} added successfully, ${failed} failed.`
            );
          }
      } catch (error) {
          // This catch handles unexpected errors (e.g., network failure, refetch issues)
          // Individual user addition failures are handled by Promise.allSettled above
          console.error(error);
          setMessage(error instanceof Error ? error.message : "An unexpected error occurred.");
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

  const existingSlackIds = useMemo(
    () => new Set(members.map((m) => m.slackId).filter(Boolean) as string[]),
    [members]
  );

  const existingMemberEmails = useMemo(
    () => new Set(members.map((m) => m.email).filter(Boolean) as string[]),
    [members]
  );

  const selectableVisibleSlackUsers = useMemo(
    () =>
      visibleSlackUsers.filter((u) => {
        const hasExistingSlackId = existingSlackIds.has(u.id);
        const hasExistingEmail = u.email ? existingMemberEmails.has(u.email) : false;
        return !hasExistingSlackId && !hasExistingEmail;
      }),
    [visibleSlackUsers, existingSlackIds, existingMemberEmails]
  );

  const allVisibleSelected =
    selectableVisibleSlackUsers.length > 0 &&
    selectableVisibleSlackUsers.every((u) => selectedSlackUsers.has(u.id));

  const someVisibleSelected =
    !allVisibleSelected && selectableVisibleSlackUsers.some((u) => selectedSlackUsers.has(u.id));

  const toggleSlackSelection = (id: string, checked: boolean) => {
    setSelectedSlackUsers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllVisibleSlackUsers = (checked: boolean) => {
    setSelectedSlackUsers((prev) => {
      const next = new Set(prev);
      selectableVisibleSlackUsers.forEach((user) => {
        if (checked) next.add(user.id);
        else next.delete(user.id);
      });
      return next;
    });
  };


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
  const memberActivitiesQuery = useQuery<ActivityRecord[]>({
    queryKey: ["member-activities", selectedMember?.id, adminQuery.data?.currentSemesterId],
    queryFn: async () => {
      if (!selectedMember) return [];
      const semesterId = adminQuery.data?.currentSemesterId || undefined;
      const acts = await fetchActivities(semesterId);
      return acts.filter((act) => act.multipliers.some((m) => m.userId === selectedMember.id));
    },
    enabled: !!selectedMember && !!adminQuery.data,
  });
  const memberActivities = useMemo(() => {
    const acts = memberActivitiesQuery.data || [];
    return acts.map((act) => {
      const multiplier =
        act.multipliers.find((m) => m.userId === selectedMember?.id)?.multiplier || 0;
      return {
        id: act.id,
        name: act.name,
        type: act.type,
        pixelsPer: act.pixels,
        multiplier,
        total: multiplier * (act.pixels || 0),
      };
    });
  }, [memberActivitiesQuery.data, selectedMember?.id]);
  const ACTIVITIES_PAGE_SIZE = 5;
  const pagedMemberActivities = useMemo(() => {
    const start = memberActivitiesPage * ACTIVITIES_PAGE_SIZE;
    return memberActivities.slice(start, start + ACTIVITIES_PAGE_SIZE);
  }, [memberActivities, memberActivitiesPage]);
  const [memberEventsView, setMemberEventsView] = useState(
    [] as {
      id: string;
      name: string;
      date: string;
      type: string;
      status: string;
      pixels: number;
    }[]
  );

  useEffect(() => {
    if (!selectedMember) {
      setMemberEventsView([]);
      return;
    }
    setMemberEventsView(memberEvents);
  }, [memberEvents, selectedMember]);

  useEffect(() => {
    setMemberEventsPage(0);
  }, [memberEventsSearch, selectedMember?.id]);

  useEffect(() => {
    setMemberActivitiesPage(0);
  }, [selectedMember?.id, memberActivities.length]);

  const filteredMemberEvents = useMemo(() => {
    const term = memberEventsSearch.trim().toLowerCase();
    if (!term) return memberEventsView;
    return memberEventsView.filter(
      (evt) =>
        evt.name.toLowerCase().includes(term) ||
        evt.type.toLowerCase().includes(term) ||
        evt.status.toLowerCase().includes(term)
    );
  }, [memberEventsSearch, memberEventsView]);

  const pagedMemberEvents = useMemo(() => {
    const start = memberEventsPage * 5;
    return filteredMemberEvents.slice(start, start + 5);
  }, [filteredMemberEvents, memberEventsPage]);

  const memberEventsTotalPages = Math.max(1, Math.ceil(filteredMemberEvents.length / 5));

  useEffect(() => {
    setMemberEventsPage((page) => Math.min(page, memberEventsTotalPages - 1));
  }, [memberEventsTotalPages]);

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
      setMemberEventsView((prev) =>
        prev.map((evt) => {
          if (evt.id !== evtId) return evt;
          const display =
            next === "present"
              ? "Present"
              : next === "excused"
                ? "Excused"
                : mandatory
                  ? "Unexcused"
                  : "Not Present";
          return { ...evt, status: display };
        })
      );
      await adminQuery.refetch();
      setMessage("Status updated.");
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
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={selected.size === 0}>
                      Bulk Actions <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Bulk Operations</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setAddToEventOpen(true)}>
                       Add to Event...
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setAddToActivityOpen(true)}>
                       Add to Activity...
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={handleDeleteSelected}
                      disabled={saving}
                    >
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Dialog open={addToEventOpen} onOpenChange={setAddToEventOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add to Event</DialogTitle>
                      <DialogDescription>Add {selected.size} selected members to an event.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                      <div className="relative w-full">
                        <Input
                          value={eventTargetSearch}
                          onChange={(e) => {
                            setEventTargetSearch(e.target.value);
                            setEventTarget("");
                          }}
                          placeholder="Search event..."
                        />
                        {eventTargetSearch.trim().length > 0 &&
                          !eventSuggestions.some(
                            (evt) =>
                              evt.name.toLowerCase() === eventTargetSearch.trim().toLowerCase()
                          ) && (
                          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-md border bg-background shadow-sm">
                            {eventSuggestions.map((evt) => (
                              <button
                                key={evt.id}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => {
                                  setEventTarget(evt.id);
                                  setEventTargetSearch(evt.name);
                                }}
                                type="button"
                              >
                                <div className="font-medium">{evt.name}</div>
                                <div className="text-xs text-muted-foreground">{evt.date}</div>
                              </button>
                            ))}
                            {!eventSuggestions.length && (
                              <div className="px-3 py-2 text-sm text-muted-foreground">No matches.</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                         <Button variant="outline" onClick={() => setAddToEventOpen(false)}>Cancel</Button>
                         <Button 
                            onClick={async () => {
                                await handleAddToEvent();
                                setAddToEventOpen(false);
                            }} 
                            disabled={saving || !eventTarget}
                          >
                            Add Members
                          </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={addToActivityOpen} onOpenChange={setAddToActivityOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add to Activity</DialogTitle>
                      <DialogDescription>Add {selected.size} selected members to an activity.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                      <div className="relative w-full">
                        <Input
                          value={activityTargetSearch}
                          onChange={(e) => {
                            setActivityTargetSearch(e.target.value);
                            setActivityTarget("");
                          }}
                          placeholder="Search activity..."
                        />
                        {activityTargetSearch.trim().length > 0 &&
                          !activitySuggestions.some(
                            (act) =>
                              act.name.toLowerCase() === activityTargetSearch.trim().toLowerCase()
                          ) && (
                          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-md border bg-background shadow-sm">
                            {activitySuggestions.map((act) => (
                              <button
                                key={act.id}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => {
                                  setActivityTarget(act.id);
                                  setActivityTargetSearch(act.name);
                                }}
                                type="button"
                              >
                                <div className="font-medium">{act.name}</div>
                                <div className="text-xs text-muted-foreground">{act.type}</div>
                              </button>
                            ))}
                            {!activitySuggestions.length && (
                              <div className="px-3 py-2 text-sm text-muted-foreground">No matches.</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                         <Button variant="outline" onClick={() => setAddToActivityOpen(false)}>Cancel</Button>
                         <Button 
                            onClick={async () => {
                                await handleAddToActivity();
                                setAddToActivityOpen(false);
                            }} 
                            disabled={saving || !activityTarget}
                          >
                            Add Members
                          </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {message && <span className="text-muted-foreground">{message}</span>}
              </div>
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
                      if (open) {
                        setSelectedSlackUsers(new Set());
                        loadSlackUsers();
                      }
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
                          <DialogTitle>Select Slack Members</DialogTitle>
                          <DialogDescription>
                                  Search and select multiple workspace users to add them in one action.
                          </DialogDescription>
                          </DialogHeader>
                          <div className="flex flex-col gap-4 flex-1 min-h-0 py-2">
                              <Input 
                                  placeholder="Search by name or email..." 
                                  value={slackSearch}
                                  onChange={e => setSlackSearch(e.target.value)}
                                  autoFocus
                              />
                              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                  <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                                        onCheckedChange={(checked) => toggleSelectAllVisibleSlackUsers(checked === true)}
                                        disabled={selectableVisibleSlackUsers.length === 0}
                                      />
                                      <span className="text-muted-foreground">
                                        Select visible ({selectableVisibleSlackUsers.length})
                                      </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {selectedSlackUsers.size} selected
                                  </span>
                              </div>
                              <div className="flex-1 overflow-y-auto border rounded-md">
                                  {loadingSlack ? (
                                      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
                                          <LoadingState variant="inline" title="Loading Slack users..." />
                                      </div>
                                  ) : (
                                      <div className="divide-y">
                                          {visibleSlackUsers.map(u => {
                                              const exists = members.some(m => m.email === u.email || m.slackId === u.id);
                                              const isSelected = selectedSlackUsers.has(u.id);
                                              return (
                                                  <div 
                                                      key={u.id} 
                                                      className={`flex items-center gap-3 p-3 transition-colors ${exists ? 'opacity-50 bg-muted/50' : 'hover:bg-muted/50'}`}
                                                  >
                                                      <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) => toggleSlackSelection(u.id, checked === true)}
                                                        disabled={exists}
                                                      />
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
                                                          <Badge variant={isSelected ? "default" : "secondary"} className="text-[10px]">
                                                            {isSelected ? "Selected" : "Available"}
                                                          </Badge>
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
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setSelectedSlackUsers(new Set())}>
                                  Clear
                                </Button>
                                <Button
                                  onClick={handleAddSelectedSlackUsers}
                                  disabled={saving || selectedSlackUsers.size === 0}
                                >
                                  {saving
                                    ? "Adding…"
                                    : selectedSlackUsers.size === 0
                                    ? "Add members"
                                    : `Add ${selectedSlackUsers.size} member${selectedSlackUsers.size === 1 ? "" : "s"}`}
                                </Button>
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
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground">Events</div>
                        <Input
                          placeholder="Search events"
                          value={memberEventsSearch}
                          onChange={(e) => setMemberEventsSearch(e.target.value)}
                          className="h-9 w-full max-w-xs"
                        />
                      </div>
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
                            {pagedMemberEvents.map((evt) => (
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
                            {filteredMemberEvents.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">
                                  No events found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      {(memberEventsSearch.trim() || filteredMemberEvents.length > 5) && (
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          {filteredMemberEvents.length > 5 && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMemberEventsPage((p) => Math.max(0, p - 1))}
                                disabled={memberEventsPage === 0}
                              >
                                Prev
                              </Button>
                              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                                Page {memberEventsPage + 1} of {memberEventsTotalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMemberEventsPage((p) =>
                                    Math.min(Math.max(0, memberEventsTotalPages - 1), p + 1)
                                  )
                                }
                                disabled={memberEventsPage >= memberEventsTotalPages - 1}
                              >
                                Next
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-4">
                      <div className="text-sm font-semibold text-foreground">Activities</div>
                      {memberActivitiesQuery.isLoading ? (
                        <LoadingState variant="inline" title="Loading activities…" />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Pixels</TableHead>
                              <TableHead className="text-right">Multiplier</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                              {pagedMemberActivities.map((act) => (
                                <TableRow key={act.id}>
                                  <TableCell>{act.name}</TableCell>
                                  <TableCell className="text-muted-foreground">{act.type}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {act.pixelsPer}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {act.multiplier}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {act.total}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {memberActivities.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
                                    No activities yet.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                      )}
                      {memberActivities.length > ACTIVITIES_PAGE_SIZE && (
                        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMemberActivitiesPage((p) => Math.max(0, p - 1))}
                            disabled={memberActivitiesPage === 0}
                          >
                            Prev
                          </Button>
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                            Page {memberActivitiesPage + 1} of {Math.max(1, Math.ceil(memberActivities.length / ACTIVITIES_PAGE_SIZE))}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setMemberActivitiesPage((p) =>
                                Math.min(Math.max(0, Math.ceil(memberActivities.length / ACTIVITIES_PAGE_SIZE) - 1), p + 1)
                              )
                            }
                            disabled={memberActivitiesPage >= Math.ceil(memberActivities.length / ACTIVITIES_PAGE_SIZE) - 1}
                          >
                            Next
                          </Button>
                        </div>
                      )}
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
