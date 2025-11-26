type Props = {
  pixelDelta: number;
};

export function AdjustmentNotice({ pixelDelta }: Props) {
  if (!pixelDelta) return null;

  return (
    <section className="rounded-2xl border border-primary/10 bg-primary/5 p-4 text-sm text-foreground shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3 3" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        Manual adjustment applied
      </div>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Your pixel total includes a manual adjustment of {pixelDelta > 0 ? "+" : ""}
        {pixelDelta}. Reach out to an admin if you have questions.
      </p>
    </section>
  );
}
