import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  subtitle?: string;
  fullHeight?: boolean;
  variant?: "card" | "inline";
  className?: string;
};

export function LoadingState({
  title = "Loading…",
  subtitle,
  fullHeight = false,
  variant = "card",
  className,
}: Props) {
  const content =
    variant === "inline" ? (
      <div className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-label="Loading" />
        <span>{title}</span>
      </div>
    ) : (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-primary/10 bg-white/80 px-6 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur",
          className
        )}
      >
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-label="Loading" />
        <div>
          <div className="text-base font-semibold text-foreground">{title}</div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    );

  if (fullHeight) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        {content}
      </div>
    );
  }

  return content;
}
