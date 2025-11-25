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
};

const PAGE_SIZE = 10;

export function PixelLogTable({ rows }: Props) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<"date" | "name" | "pixels">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [page, sortedRows]);

  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  const toggleSort = (key: "date" | "name" | "pixels") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pixel log</h2>
          <p className="text-sm text-muted-foreground">{rows.length} events</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={!canPrev}>
            Prev
          </Button>
          <span className="text-muted-foreground">
            Page {page + 1} of {totalPages}
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
              <TableHead>Date</TableHead>
              <TableHead>
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1">
                  Name {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => toggleSort("pixels")}
                  className="flex w-full items-center justify-end gap-1"
                >
                  Pixels Allocated {sortKey === "pixels" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </button>
              </TableHead>
              <TableHead className="text-right">Pixels Earned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-foreground">{row.date}</TableCell>
                <TableCell className="text-foreground">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.type}</TableCell>
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
