import { LeaderboardRow } from "@/lib/dashboard";
import { Trophy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Props = {
  rows: LeaderboardRow[];
  enabled: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  disabled?: boolean;
};

export function Leaderboard({ rows, enabled, hasMore, loadingMore, onLoadMore, disabled }: Props) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Leaderboard</h2>
            <p className="text-sm text-muted-foreground">See how goated you are.</p>
          </div>
        </div>
        {!enabled && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            Hidden
          </span>
        )}
      </div>
      {!enabled ? (
        <p className="text-sm text-muted-foreground">Leaderboard is disabled for this semester.</p>
      ) : (
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-right text-muted-foreground">Pixels</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.id} className="odd:bg-muted/30">
                  <TableCell className="text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/10">
                      {idx + 1}
                    </span>
                  </TableCell>
                  <TableCell className="text-foreground">{row.name}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {row.pixels}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                    No leaderboard data yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      )}
      {enabled && hasMore && onLoadMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore || disabled}>
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />
                Loading...
              </span>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
