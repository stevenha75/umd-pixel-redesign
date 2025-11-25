import { LeaderboardRow } from "@/lib/dashboard";

type Props = {
  rows: LeaderboardRow[];
  enabled: boolean;
};

export function Leaderboard({ rows, enabled }: Props) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Leaderboard</h2>
        {!enabled && <span className="text-xs font-medium text-zinc-500">Hidden</span>}
      </div>
      {!enabled ? (
        <p className="text-sm text-zinc-600">Leaderboard is disabled for this semester.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium text-right">Pixels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 text-zinc-700">{idx + 1}</td>
                  <td className="px-3 py-2 text-zinc-900">{row.name}</td>
                  <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                    {row.pixels}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
                    No leaderboard data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
