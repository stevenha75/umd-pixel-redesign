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

export default function SettingsPage() {
  const [currentSemesterId, setCurrentSemesterId] = useState("");
  const [isLeadershipOn, setIsLeadershipOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(null);
    try {
      await updateDoc(doc(db, "settings", "global"), {
        currentSemesterId: currentSemesterId.trim(),
        isLeadershipOn,
      });
      setMessage("Settings saved.");
      settingsQuery.refetch();
    } catch (err) {
      console.error(err);
      setMessage("Failed to save settings.");
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
              <CardDescription>Aligns with legacy admin settings.</CardDescription>
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
                {message && <span className="text-sm text-muted-foreground">{message}</span>}
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
