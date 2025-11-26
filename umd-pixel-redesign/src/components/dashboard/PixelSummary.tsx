import React from "react";

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
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-secondary/30 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-primary">
                  Welcome back
                </div>
                <div className="text-xl font-semibold text-foreground">{name}</div>
                <div className="text-sm text-muted-foreground">{email}</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/10">
              Pixels live
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-primary/10 bg-white/60 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total pixels
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-4xl font-bold text-foreground">{pixelTotal}</div>
                <div className="text-sm text-muted-foreground">pts</div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white/60 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rank
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {rank ? `#${rank}` : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white/60 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adjustment
              </div>
              <div className={`mt-2 text-2xl font-semibold ${pixelDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                {pixelDelta > 0 ? "+" : ""}
                {pixelDelta}
              </div>
            </div>
          </div>
        </div>
      </div>
      {pixelDelta !== 0 && (
        <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4 text-sm text-foreground shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              +
            </span>
            Manual adjustment applied
          </div>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {pixelDelta > 0 ? "+" : ""}
            {pixelDelta} pixels added by an admin. Reach out if anything feels off.
          </p>
        </div>
      )}
    </div>
  );
}
