import { PixelLogRow } from "@/lib/dashboard";

type Props = {
  rows: PixelLogRow[];
};

export function PixelLogTable({ rows }: Props) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Pixel log</h2>
        <div className="text-sm text-zinc-500">{rows.length} events</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Attendance</th>
              <th className="px-3 py-2 font-medium text-right">Pixels Allocated</th>
              <th className="px-3 py-2 font-medium text-right">Pixels Earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-50">
                <td className="px-3 py-2 whitespace-nowrap text-zinc-800">{row.date}</td>
                <td className="px-3 py-2 text-zinc-900">{row.name}</td>
                <td className="px-3 py-2 text-zinc-700">{row.type}</td>
                <td className="px-3 py-2 text-zinc-700">{row.attendance}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{row.pixelsAllocated}</td>
                <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                  {row.pixelsEarned}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
