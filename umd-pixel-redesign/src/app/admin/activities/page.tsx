"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityRecord,
  createActivity,
  deleteActivity,
  fetchActivities,
  fetchAdminData,
  setActivityMultiplier,
  updateActivity,
  findUserIdByEmail,
  fetchUserDetails,
} from "@/lib/api";

export default function ActivitiesPage() {
  const adminQuery = useQuery({ queryKey: ["admin-data"], queryFn: fetchAdminData });
  const activitiesQuery = useQuery<ActivityRecord[]>({
    queryKey: ["activities"],
    queryFn: async () => {
      const semesterId = adminQuery.data?.currentSemesterId || undefined;
      return fetchActivities(semesterId);
    },
    enabled: !!adminQuery.data,
  });

  const [multiplierDetails, setMultiplierDetails] = useState<Map<string, { name: string; email: string }>>(new Map());

  const loadMultiplierDetails = async (activityId: string) => {
    const activity = activitiesQuery.data?.find((a) => a.id === activityId);
    if (!activity) return;
    const ids = activity.multipliers.map((m) => m.userId);
    const details = await fetchUserDetails(ids);
    setMultiplierDetails(details);
  };

  const [form, setForm] = useState({ name: "", type: "coffee_chat", pixels: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [multiplierUser, setMultiplierUser] = useState("");
  const [multiplierValue, setMultiplierValue] = useState(1);
  const [targetActivity, setTargetActivity] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreateOrUpdate = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateActivity(editingId, form);
      } else {
        await createActivity({
          ...form,
          semesterId: adminQuery.data?.currentSemesterId,
        });
      }
      setForm({ name: "", type: "coffee_chat", pixels: 0 });
      setEditingId(null);
      await activitiesQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await deleteActivity(id);
      await activitiesQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleSetMultiplier = async () => {
    if (!targetActivity || !multiplierUser.trim()) return;
    setSaving(true);
    try {
      const value = Number(multiplierValue) || 1;
      const emailLookup = multiplierUser.includes("@");
      const userId = emailLookup
        ? await findUserIdByEmail(multiplierUser.trim())
        : multiplierUser.trim();
      if (!userId) {
        setSaving(false);
        return;
      }
      await setActivityMultiplier(targetActivity, userId, value);
      await activitiesQuery.refetch();
      setMultiplierUser("");
      setMultiplierValue(1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout>
        <div className="flex flex-col gap-6 pb-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Activities</h1>
            <p className="text-sm text-muted-foreground">
              Track coffee chats, bonding, and other activities with per-member multipliers.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit activity" : "Create activity"}</CardTitle>
              <CardDescription>Pixels will apply multiplier per member.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Activity name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coffee_chat">Coffee Chat</SelectItem>
                  <SelectItem value="bonding">Bonding</SelectItem>
                  <SelectItem value="other">Other Activity</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                value={form.pixels}
                onChange={(e) => setForm((f) => ({ ...f, pixels: Number(e.target.value) }))}
                placeholder="Pixels value"
              />
              <div className="flex items-center gap-3">
                <Button onClick={handleCreateOrUpdate} disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create activity"}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Activities list</CardTitle>
                <CardDescription>
                  {activitiesQuery.isLoading
                    ? "Loading…"
                    : `${activitiesQuery.data?.length || 0} activities`}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Pixels</TableHead>
                      <TableHead className="text-right">Multipliers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activitiesQuery.data?.map((act) => (
                      <TableRow key={act.id}>
                        <TableCell className="text-foreground">{act.name}</TableCell>
                        <TableCell className="text-muted-foreground">{act.type}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {act.pixels}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {act.multipliers.length}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditingId(act.id);
                              setForm({ name: act.name, type: act.type, pixels: act.pixels });
                            }}>
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTargetActivity(act.id)}
                            >
                              Manage
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(act.id)}
                              disabled={saving}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!activitiesQuery.data?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                          No activities yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manage multipliers</CardTitle>
              <CardDescription>Set multiplier per member for an activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                  <Select
                    value={targetActivity || ""}
                    onValueChange={async (v) => {
                      setTargetActivity(v);
                      await loadMultiplierDetails(v);
                    }}
                  >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select activity" />
                </SelectTrigger>
                <SelectContent>
                  {activitiesQuery.data?.map((act) => (
                    <SelectItem key={act.id} value={act.id}>
                      {act.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  placeholder="User ID"
                  value={multiplierUser}
                  onChange={(e) => setMultiplierUser(e.target.value)}
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Multiplier"
                  value={multiplierValue}
                  onChange={(e) => setMultiplierValue(Number(e.target.value))}
                />
                <Button onClick={handleSetMultiplier} disabled={saving || !targetActivity || !multiplierUser}>
                  Set multiplier
                </Button>
              </div>
              {targetActivity && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Multiplier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activitiesQuery.data
                        ?.find((a) => a.id === targetActivity)
                        ?.multipliers.map((m) => {
                          const details = multiplierDetails.get(m.userId);
                          return (
                            <TableRow key={m.userId}>
                              <TableCell className="text-foreground">
                                {details?.name || m.userId}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {details?.email || ""}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {m.multiplier}
                              </TableCell>
                            </TableRow>
                          );
                        }) ?? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
                            No multipliers yet.
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
      </AdminLayout>
    </ProtectedRoute>
  );
}
