"use client";

import { useEffect, useMemo, useState } from "react";
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

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);
import { useQuery } from "@tanstack/react-query";
import {
  MemberRecord,
  fetchMembers,
  addMember,
  updateMember,
  deleteMember,
  fetchAdminData,
  addAttendee,
  setAttendanceStatus,
  mergeMembers,
} from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function MembersPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"pixels" | "name">("pixels");
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [newMember, setNewMember] = useState({ firstName: "", lastName: "", email: "" });
  const [eventTarget, setEventTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");

  const membersQuery = useQuery<MemberRecord[]>({ queryKey: ["members"], queryFn: fetchMembers });
  const adminQuery = useQuery({ queryKey: ["admin-data"], queryFn: fetchAdminData });

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

  const handleAddMember = async () => {
    if (!newMember.firstName.trim() || !newMember.email.trim()) return;
    setSaving(true);
    try {
      await addMember({
        firstName: newMember.firstName.trim(),
        lastName: newMember.lastName.trim(),
        email: newMember.email.trim().toLowerCase(),
      });
      await membersQuery.refetch();
      setNewMember({ firstName: "", lastName: "", email: "" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMember = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateMember(editing.id, {
        firstName: editing.firstName,
        lastName: editing.lastName,
        email: editing.email.toLowerCase(),
      });
      await membersQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

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

  const handleMerge = async () => {
    if (selected.size !== 2 || !mergeTargetId) return;
    
    const ids = Array.from(selected);
    const sourceId = ids.find(id => id !== mergeTargetId);
    
    if (!sourceId) return;

    setSaving(true);
    try {
        await mergeMembers(sourceId, mergeTargetId);
        
        // 1. Force a hard refetch to get the latest list (removed user gone)
        await membersQuery.refetch();
        
        // 2. Clear selection state
        clearSelection();
        setMergeTargetId("");
        setMergeDialogOpen(false);
        
        setMessage("Members merged successfully.");
    } catch (error) {
        console.error("Merge failed:", error);
        setMessage("Failed to merge members.");
    } finally {
        setSaving(false);
    }
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

  const pixelHistory = useMemo(() => {
    if (!memberEvents.length) return null;
    const sorted = [...memberEvents].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let total = 0;
    const points = sorted.map((evt) => {
      if (evt.status === "Present" && evt.pixels > 0) {
        total += evt.pixels;
      }
      return { date: evt.date, total };
    });
    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          label: "Pixels over time",
          data: points.map((p) => p.total),
          borderColor: "#000",
          backgroundColor: "rgba(0,0,0,0.1)",
          tension: 0.3,
        },
      ],
    };
  }, [memberEvents]);

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
                <Select value={eventTarget} onValueChange={(v) => setEventTarget(v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Add to event" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminQuery.data?.events.map((evt) => (
                      <SelectItem key={evt.id} value={evt.id}>
                        {evt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddToEvent} disabled={saving || selected.size === 0 || !eventTarget}>
                  Add to event
                </Button>
                {selected.size === 2 && (
                    <Button 
                        variant="secondary"
                        onClick={() => setMergeDialogOpen(true)}
                        disabled={saving}
                    >
                        Merge selected
                    </Button>
                )}
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
                    {members.map((m) => (
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
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Add Member</CardTitle>
                <CardDescription>Create a new member manually.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="First name"
                  value={newMember.firstName}
                  onChange={(e) => setNewMember((p) => ({ ...p, firstName: e.target.value }))}
                />
                <Input
                  placeholder="Last name"
                  value={newMember.lastName}
                  onChange={(e) => setNewMember((p) => ({ ...p, lastName: e.target.value }))}
                />
                <Input
                  placeholder="Email"
                  value={newMember.email}
                  onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                />
                <Button onClick={handleAddMember} disabled={saving}>
                  {saving ? "Saving…" : "Add member"}
                </Button>
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
                    <Input
                      value={selectedMember.firstName}
                      onChange={(e) =>
                        setEditing((prev) => prev && { ...prev, firstName: e.target.value })
                      }
                    />
                    <Input
                      value={selectedMember.lastName}
                      onChange={(e) =>
                        setEditing((prev) => prev && { ...prev, lastName: e.target.value })
                      }
                    />
                    <Input
                      value={selectedMember.email}
                      onChange={(e) =>
                        setEditing((prev) => prev && { ...prev, email: e.target.value })
                      }
                    />
                    <div className="text-sm text-muted-foreground">
                      Pixels: {selectedMember.pixels} (Delta {selectedMember.pixelDelta})
                    </div>
                    <Button onClick={handleUpdateMember} disabled={saving}>
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                    {pixelHistory && (
                      <div className="rounded-lg border border-border p-3">
                        <Line
                          data={pixelHistory}
                          options={{
                            responsive: true,
                            plugins: { legend: { display: false } },
                            scales: { y: { beginAtZero: true } },
                          }}
                        />
                      </div>
                    )}
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

      <Dialog open={mergeDialogOpen} onOpenChange={(open) => {
        if (!open) {
            setMergeDialogOpen(false);
            setMergeTargetId("");
        } else {
            setMergeDialogOpen(true);
        }
      }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Merge Members</DialogTitle>
                <DialogDescription>
                    You are about to merge 2 users. This cannot be undone.
                    Select the account to <strong>KEEP</strong> (the other will be deleted and its data merged into this one).
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <label className="text-sm font-medium mb-2 block">Target Account (Keep)</label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select account to keep" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from(selected).map(id => {
                            const m = members.find(mem => mem.id === id);
                            if (!m) return null;
                            return (
                                <SelectItem key={m.id} value={m.id}>
                                    <span className="flex items-center gap-2">
                                        {m.firstName} {m.lastName} ({m.email})
                                        {m.slackId && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Slack</Badge>}
                                    </span>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                    Tip: Usually you want to keep the <strong>Slack</strong> account to ensure login works.
                </p>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleMerge} disabled={saving || !mergeTargetId}>
                    {saving ? "Merging..." : "Confirm Merge"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
