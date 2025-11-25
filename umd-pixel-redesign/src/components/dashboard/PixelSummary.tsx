type Props = {
  name: string;
  email: string;
  pixelTotal: number;
  pixelDelta: number;
  rank?: number;
};

export function PixelSummary({ name, email, pixelTotal, pixelDelta, rank }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="text-sm uppercase tracking-wide text-muted-foreground">Welcome</div>
          <div className="text-2xl font-semibold text-foreground">{name}</div>
          <div className="text-sm text-muted-foreground">{email}</div>
        </div>
        <div className="mt-6 flex items-baseline gap-3">
          <div className="text-4xl font-bold text-foreground">{pixelTotal}</div>
          <div className="text-sm text-muted-foreground">pixels</div>
        </div>
        {rank && (
          <div className="mt-2 text-sm text-muted-foreground">Rank: #{rank}</div>
        )}
      </div>
      {pixelDelta !== 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm">
          <div className="font-semibold">Manual adjustment applied</div>
          <p className="mt-1 leading-relaxed">
            {pixelDelta > 0 ? "+" : ""}
            {pixelDelta} pixels added by an admin.
          </p>
        </div>
      )}
    </div>
  );
}
