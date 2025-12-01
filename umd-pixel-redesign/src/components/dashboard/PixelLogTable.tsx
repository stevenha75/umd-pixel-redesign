import { useMemo, useState } from "react";
import { PixelLogRow } from "@/lib/dashboard";
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
  rows: PixelLogRow[];
  totalCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
  loadingMore?: boolean;
};

const PAGE_SIZE = 10;

export function PixelLogTable({ rows, totalCount, hasMore, onLoadMore, loadingMore }: Props) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<"date" | "name" | "pixels">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const typeLabels: Record<string, string> = {
    GBM: "GBM",
    other_mandatory: "Other mandatory",
    sponsor_event: "Sponsor event",
    other_prof_dev: "Other professional development",
    social: "Social",
    other_optional: "Other optional",
    pixel_activity: "Pixel activity",
    special: "Special",
  };

  const formatType = (type: string) => {
    if (typeLabels[type]) return typeLabels[type];
    return type
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "pixels") return dir * ((a.pixelsAllocated || 0) - (b.pixelsAllocated || 0));
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      return dir * (new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    return copy;
  }, [rows, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, sortedRows]);

  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1;

  const toggleSort = (key: "date" | "name" | "pixels") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const displayed = totalCount ?? sortedRows.length;
  const showLoadMore = hasMore && onLoadMore;

  return (
    <section className="rounded-2xl border border-primary/10 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 17h7M5 7h9" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pixel log</h2>
            <p className="text-sm text-muted-foreground">
              Showing {Math.min(sortedRows.length, displayed)} of {displayed} events
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {showLoadMore && (
            <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load older events"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={!canPrev}>
            Prev
          </Button>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={!canNext}>
            Next
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("name")}
                  className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-left text-foreground transition hover:bg-muted"
                >
                  Name{" "}
                  {sortKey === "name" ? (
                    <span className="text-xs text-primary">{sortDir === "asc" ? "▲" : "▼"}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">↕</span>
                  )}
                </button>
              </TableHead>
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Attendance</TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => toggleSort("pixels")}
                  className="flex w-full items-center justify-end gap-2 rounded-full px-2 py-1 text-right text-foreground transition hover:bg-muted"
                >
                  Pixels Allocated{" "}
                  {sortKey === "pixels" ? (
                    <span className="text-xs text-primary">{sortDir === "asc" ? "▲" : "▼"}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">↕</span>
                  )}
                </button>
              </TableHead>
              <TableHead className="text-right text-muted-foreground">Pixels Earned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.id} className="odd:bg-muted/30">
                <TableCell className="whitespace-nowrap text-foreground">{row.date}</TableCell>
                <TableCell className="text-foreground">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{formatType(row.type)}</TableCell>
                <TableCell className="text-muted-foreground">{row.attendance}</TableCell>
                <TableCell className="text-right text-muted-foreground">{row.pixelsAllocated}</TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {row.pixelsEarned}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  No events yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
