import { cn } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/format";

const tones = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-accent text-accent-foreground border-primary/20",
  warn: "bg-warning/20 text-warning-foreground border-warning/40",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  ok: "bg-success/10 text-success border-success/30",
};

export function StatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[s.tone])}>
      {s.label}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}
