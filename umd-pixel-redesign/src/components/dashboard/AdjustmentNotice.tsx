type Props = {
  pixelDelta: number;
};

export function AdjustmentNotice({ pixelDelta }: Props) {
  if (!pixelDelta) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
      <div className="font-semibold">Manual adjustment applied</div>
      <p className="mt-1 leading-relaxed">
        Your pixel total includes a manual adjustment of {pixelDelta > 0 ? "+" : ""}
        {pixelDelta}. Reach out to an admin if you have questions.
      </p>
    </section>
  );
}
