import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: "neutral" | "warning" | "danger" | "positive";
}

const toneClasses = {
  neutral: "text-slate-50",
  warning: "text-amber-300",
  danger: "text-rose-300",
  positive: "text-emerald-300"
} as const;

export function MetricCard({ label, value, detail, tone = "neutral" }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-xl font-semibold tracking-tight ${toneClasses[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}
