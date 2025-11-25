import { useMemo, useState } from "react";
import { PixelLogRow } from "@/lib/dashboard";

type Props = {
  rows: PixelLogRow[];
};

const PAGE_SIZE = 10;

export function PixelLogTable({ rows }: Props) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [page, rows]);

  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Pixel log</h2>
          <p className="text-sm text-zinc-500">{rows.length} events</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => canPrev && setPage((p) => p - 1)}
            disabled={!canPrev}
            className="rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-zinc-600">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => canNext && setPage((p) => p + 1)}
            disabled={!canNext}
            className="rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
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
            {pageRows.map((row) => (
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
