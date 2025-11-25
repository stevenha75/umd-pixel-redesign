type Props = {
  name: string;
  email: string;
  pixelTotal: number;
  pixelDelta: number;
};

export function PixelSummary({ name, email, pixelTotal, pixelDelta }: Props) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="text-sm uppercase tracking-wide text-zinc-500">Welcome</div>
        <div className="text-2xl font-semibold text-zinc-900">{name}</div>
        <div className="text-sm text-zinc-600">{email}</div>
      </div>
      <div className="mt-6 flex items-baseline gap-3">
        <div className="text-4xl font-bold text-zinc-900">{pixelTotal}</div>
        <div className="text-sm text-zinc-600">pixels</div>
      </div>
      {pixelDelta !== 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Manual adjustment applied: {pixelDelta > 0 ? "+" : ""}
          {pixelDelta}
        </div>
      )}
    </section>
  );
}
