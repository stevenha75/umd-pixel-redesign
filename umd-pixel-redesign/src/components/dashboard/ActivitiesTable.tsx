import { ActivityRow } from "@/lib/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  rows: ActivityRow[];
};

export function ActivitiesTable({ rows }: Props) {
  if (!rows.length) return null;

  return (
    <Card className="border-primary/10 bg-white/90 shadow-sm backdrop-blur">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/40 text-secondary-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12M6 8h12M6 16h8" />
              </svg>
            </span>
            Activities
          </CardTitle>
          <CardDescription>Pixels from coffee chats, bonding, and other activities.</CardDescription>
        </div>
        <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          {rows.length} records
        </div>
      </CardHeader>
      <CardContent>
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
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground ring-1 ring-accent/50">
                      {row.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.pixelsPer}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.multiplier}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
