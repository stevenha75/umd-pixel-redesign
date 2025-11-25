import { ActivityRow } from "@/lib/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  rows: ActivityRow[];
};

export function ActivitiesTable({ rows }: Props) {
  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activities</CardTitle>
        <CardDescription>Pixels from coffee chats, bonding, and other activities.</CardDescription>
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
                <TableRow key={row.id}>
                  <TableCell className="text-foreground">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.type}</TableCell>
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
