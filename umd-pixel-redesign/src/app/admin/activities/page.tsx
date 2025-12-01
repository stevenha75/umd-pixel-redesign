"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/LoadingState";
import {
  ACTIVITIES_PAGE_SIZE,
  ActivityCursor,
  ActivityPage,
  ActivityRecord,
  createActivity,
  deleteActivity,
  fetchActivitiesPage,
  fetchAdminData,
  setActivityMultiplier,
  updateActivity,
  findUserIdByEmail,
  fetchUserDetails,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ActivitiesPage() {
  const { user } = useAuth();

  const adminQuery = useQuery({
    queryKey: ["admin-data", user?.uid],
    queryFn: fetchAdminData,
    enabled: !!user,
  });
  const activitiesQuery = useQuery<ActivityPage>({
    queryKey: ["activities", adminQuery.data?.currentSemesterId],
    queryFn: async () => {
      const semesterId = adminQuery.data?.currentSemesterId || undefined;
      return fetchActivitiesPage({ semesterId, includeTotal: true });
    },
    enabled: !!adminQuery.data,
  });

  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [activityCursor, setActivityCursor] = useState<ActivityCursor | null>(null);
  const [activityTotal, setActivityTotal] = useState<number | undefined>(undefined);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
  const [multiplierDetails, setMultiplierDetails] = useState<Map<string, { name: string; email: string }>>(new Map());
  const hasMoreActivities = activityCursor !== null;
  const ACTIVITY_SUGGESTION_LIMIT = 8;

  useEffect(() => {
    if (activitiesQuery.data) {
      setActivities(activitiesQuery.data.rows);
      setActivityCursor(activitiesQuery.data.nextCursor);
      setActivityTotal(activitiesQuery.data.total);
    } else {
      setActivities([]);
      setActivityCursor(null);
      setActivityTotal(undefined);
    }
  }, [activitiesQuery.data]);

  const loadMultiplierDetails = async (activityId: string) => {
    const activity = activities.find((a) => a.id === activityId);
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
  const [targetActivitySearch, setTargetActivitySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const activitySuggestions = useMemo(() => {
    const term = targetActivitySearch.trim().toLowerCase();
    if (!term) return activities.slice(0, ACTIVITY_SUGGESTION_LIMIT);
    return activities
      .filter((act) => act.name.toLowerCase().includes(term))
      .slice(0, ACTIVITY_SUGGESTION_LIMIT);
  }, [activities, targetActivitySearch]);

  useEffect(() => {
    if (!targetActivity) return;
    const matched = activities.find((act) => act.id === targetActivity);
    if (matched) setTargetActivitySearch(matched.name);
  }, [targetActivity, activities]);

  const handleCreateOrUpdate = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateActivity(editingId, form);
      } else {
        await createActivity({
          ...form,
          semesterId: adminQuery.data?.currentSemesterId || undefined,
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

  const loadMoreActivities = async () => {
    if (!hasMoreActivities || loadingMoreActivities || activitiesQuery.isFetching) return;
    setLoadingMoreActivities(true);
    try {
      const semesterId = adminQuery.data?.currentSemesterId || undefined;
      const nextPage = await fetchActivitiesPage({ semesterId, cursor: activityCursor });
      setActivities((prev) => [...prev, ...nextPage.rows]);
      setActivityCursor(nextPage.nextCursor);
      setActivityTotal((prev) => prev ?? nextPage.total);
    } finally {
      setLoadingMoreActivities(false);
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
                  {activitiesQuery.isLoading ? (
                    <LoadingState variant="inline" title="Loading activities…" />
                  ) : (
                    `Showing ${activities.length} of ${activityTotal ?? activities.length} activities`
                  )}
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
                    {activities.map((act) => (
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
                    {!activities.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                          No activities yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {hasMoreActivities && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreActivities}
                    disabled={loadingMoreActivities || activitiesQuery.isFetching}
                  >
                    {loadingMoreActivities ? "Loading…" : `Load more (next ${ACTIVITIES_PAGE_SIZE})`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manage multipliers</CardTitle>
              <CardDescription>Set multiplier per member for an activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative w-64">
                <p className="text-xs text-muted-foreground pb-1">
                  Type to search activities (suggestions capped).
                </p>
                <Input
                  value={targetActivitySearch}
                  onChange={(e) => {
                    setTargetActivitySearch(e.target.value);
                    setTargetActivity(null);
                  }}
                  placeholder="Search activity"
                />
                {targetActivitySearch.trim().length > 0 && (
                  <div className="absolute z-10 mt-2 w-full rounded-md border bg-background shadow-sm">
                    {activitySuggestions.map((act) => (
                      <button
                        key={act.id}
                        className="w-full px-3 py-2 text-left hover:bg-muted"
                        onClick={async () => {
                          setTargetActivity(act.id);
                          setTargetActivitySearch(act.name);
                          await loadMultiplierDetails(act.id);
                        }}
                        type="button"
                      >
                        <div className="text-sm text-foreground">{act.name}</div>
                        <div className="text-xs text-muted-foreground">{act.type}</div>
                      </button>
                    ))}
                    {!activitySuggestions.length && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
                    )}
                  </div>
                )}
              </div>
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
                      {activities
                        .find((a) => a.id === targetActivity)
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
