"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { PixelLogTable } from "@/components/dashboard/PixelLogTable";
import { PixelSummary } from "@/components/dashboard/PixelSummary";
import { AdjustmentNotice } from "@/components/dashboard/AdjustmentNotice";
import { ActivitiesTable } from "@/components/dashboard/ActivitiesTable";
import { useAuth } from "@/context/AuthContext";
import { DashboardData, PixelLogCursor, PixelLogRow, fetchDashboardData, fetchPixelLogPage } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";

export default function Home() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ["dashboard", user?.uid],
    queryFn: () => fetchDashboardData(user!.uid),
    enabled: !!user,
    staleTime: 60_000,
  });

  const [pixelRows, setPixelRows] = useState<PixelLogRow[]>([]);
  const [pixelCursor, setPixelCursor] = useState<PixelLogCursor | null>(null);
  const [pixelTotal, setPixelTotal] = useState<number | undefined>(undefined);
  const [loadingMorePixels, setLoadingMorePixels] = useState(false);

  const hasMorePixelRows = pixelCursor !== null && (pixelTotal === undefined || pixelRows.length < pixelTotal);

  useEffect(() => {
    if (!data) {
      setPixelRows([]);
      setPixelCursor(null);
      setPixelTotal(undefined);
      return;
    }
    setPixelRows(data.pixelLog);
    setPixelCursor(data.pixelLogCursor);
    setPixelTotal(data.pixelLogTotal);
  }, [data]);

  const loadMorePixelRows = async () => {
    if (!user || !hasMorePixelRows || loadingMorePixels) return;
    setLoadingMorePixels(true);
    try {
      const nextPage = await fetchPixelLogPage({
        userId: user.uid,
        semesterId: data?.currentSemesterId,
        cursor: pixelCursor,
      });
      setPixelRows((prev) => [...prev, ...nextPage.rows]);
      setPixelCursor(nextPage.nextCursor);
      setPixelTotal((prev) => prev ?? nextPage.total ?? undefined);
    } finally {
      setLoadingMorePixels(false);
    }
  };

  return (
    <ProtectedRoute>
      <Navbar />
      <main>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Hack4Impact UMD
              </p>
              <h1 className="text-2xl font-bold text-foreground">Pixel dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Quick view of your attendance and activities.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-secondary/30 px-3 py-1 text-xs font-semibold text-secondary-foreground ring-1 ring-secondary/40">
                Live sync enabled
              </span>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    Refreshing
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 19A9 9 0 0 0 18 7M19 5A9 9 0 0 0 6 17" />
                    </svg>
                    Refresh
                  </span>
                )}
              </Button>
            </div>
          </header>
          {isLoading && (
            <LoadingState
              title="Loading your dashboard"
              subtitle="Pulling in events and pixels—hang tight."
            />
          )}
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive shadow-sm">
              <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-white">!</span>
              <div>
                <div className="text-base font-semibold text-destructive">Could not load dashboard.</div>
                <p className="text-sm text-destructive/80">Please try refreshing the page.</p>
              </div>
            </div>
          )}
          {data && (
            <>
              <PixelSummary
                name={data.userName}
                email={data.email}
                pixelTotal={data.pixelTotal}
                pixelDelta={data.pixelDelta}
                rank={data.rank}
              />
              <AdjustmentNotice pixelDelta={data.pixelDelta} />
              <PixelLogTable
                rows={pixelRows}
                totalCount={pixelTotal}
                hasMore={hasMorePixelRows}
                onLoadMore={loadMorePixelRows}
                loadingMore={loadingMorePixels}
              />
              <ActivitiesTable rows={data.activities} />
              <Leaderboard rows={data.leaderboard} enabled={data.leaderboardEnabled} />
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
