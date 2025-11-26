"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useQuery } from "@tanstack/react-query";
import { setAdminFlag } from "@/lib/api";
import { CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function SettingsPage() {
  const [currentSemesterId, setCurrentSemesterId] = useState("");
  const [isLeadershipOn, setIsLeadershipOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adminId, setAdminId] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "settings", "global"));
      return snap.data() || {};
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setCurrentSemesterId(settingsQuery.data.currentSemesterId || "");
      setIsLeadershipOn(!!settingsQuery.data.isLeadershipOn);
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "settings", "global"), {
        currentSemesterId: currentSemesterId.trim(),
        isLeadershipOn,
      });
      toast.success("Settings saved.");
      settingsQuery.refetch();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminId.trim()) return;
    setSaving(true);
    try {
      await setAdminFlag(adminId.trim(), true);
      setAdminId("");
      toast.success("Admin access granted.", {
        description: "The user must log out and log back in to receive permissions.",
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update admin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout>
        <div className="flex flex-col gap-6 pb-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Admin Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage global settings for semesters and leaderboard visibility.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Semester & Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">Current Semester ID</label>
                <Input
                  value={currentSemesterId}
                  onChange={(e) => setCurrentSemesterId(e.target.value)}
                  placeholder="Enter semester document ID"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="leaderboard"
                  checked={isLeadershipOn}
                  onCheckedChange={(v) => setIsLeadershipOn(!!v)}
                />
                <label htmlFor="leaderboard" className="text-sm text-foreground">
                  Enable leaderboard visibility
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving || settingsQuery.isLoading}>
                  {saving ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin access</CardTitle>
              <CardDescription>Grant admin to a user ID.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="User ID"
              />
              <Button onClick={handleAddAdmin} disabled={saving}>
                Grant admin
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Archive & reset</CardTitle>
              <CardDescription>Manual safeguards; no destructive defaults.</CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Export CSV (members/events)</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export instructions</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Use the admin tables to export client-side CSVs (planned) or run Firestore export
                    via CLI. No automated archive/reset is performed to avoid data loss.
                  </p>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Reset semester (manual)</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset semester</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    To reset: 1) archive events/activities to a collection copy, 2) clear attendees,
                    excused absences, multipliers, 3) set new `currentSemesterId`. This UI does not
                    automate resets to prevent unintended data loss.
                  </p>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
