"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { PixelLogTable } from "@/components/dashboard/PixelLogTable";
import { PixelSummary } from "@/components/dashboard/PixelSummary";
import { useAuth } from "@/context/AuthContext";
import { DashboardData, fetchDashboardData } from "@/lib/dashboard";

export default function Home() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const dashboard = await fetchDashboardData(user.uid);
        setData(dashboard);
      } catch (err: any) {
        console.error(err);
        setError("Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <ProtectedRoute>
      <Navbar />
      <main className="bg-zinc-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
          {loading && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
              Loading dashboard…
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 shadow-sm">
              {error}
            </div>
          )}
          {data && (
            <>
              <PixelSummary
                name={data.userName}
                email={data.email}
                pixelTotal={data.pixelTotal}
                pixelDelta={data.pixelDelta}
              />
              <PixelLogTable rows={data.pixelLog} />
              <Leaderboard rows={data.leaderboard} enabled={data.leaderboardEnabled} />
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
