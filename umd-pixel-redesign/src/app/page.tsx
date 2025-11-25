"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { PixelLogTable } from "@/components/dashboard/PixelLogTable";
import { PixelSummary } from "@/components/dashboard/PixelSummary";
import { AdjustmentNotice } from "@/components/dashboard/AdjustmentNotice";
import { ActivitiesTable } from "@/components/dashboard/ActivitiesTable";
import { useAuth } from "@/context/AuthContext";
import { DashboardData, fetchDashboardData } from "@/lib/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ["dashboard", user?.uid],
    queryFn: () => fetchDashboardData(user!.uid),
    enabled: !!user,
    staleTime: 60_000,
  });

  return (
    <ProtectedRoute>
      <Navbar />
      <main className="bg-zinc-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
          {isLoading && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
              Loading dashboard…
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 shadow-sm">
              Could not load dashboard data.
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
              <AdjustmentNotice pixelDelta={data.pixelDelta} />
              <PixelLogTable rows={data.pixelLog} />
              <ActivitiesTable rows={data.activities} />
              <Leaderboard rows={data.leaderboard} enabled={data.leaderboardEnabled} />
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                  {isFetching ? "Refreshing…" : "Refresh"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
