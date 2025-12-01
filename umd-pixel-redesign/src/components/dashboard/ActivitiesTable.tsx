import { ActivityRow } from "@/lib/dashboard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  rows: ActivityRow[];
};

function getTypeStyles(type: string) {
  switch (type) {
    case "coffee_chat":
      return "bg-blue-500/10 text-blue-700 ring-blue-500/20";
    case "bonding":
      return "bg-purple-500/10 text-purple-700 ring-purple-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 ring-slate-500/20";
  }
}

function formatType(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ActivitiesTable({ rows }: Props) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Activity Pixels</h2>
            <p className="text-sm text-muted-foreground">Pixels from coffee chats, bonding, and other activities.</p>
          </div>
        </div>
        <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          {rows.length} records
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Pixels per</TableHead>
                <TableHead className="text-right">Multiplier</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="odd:bg-muted/30">
                  <TableCell className="text-foreground">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold ring-1",
                        getTypeStyles(row.type)
                      )}
                    >
                      {formatType(row.type)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.pixelsPer}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.multiplier}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{row.total}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    No activities yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </div>
    </section>
  );
}
