import type { LucideIcon } from "lucide-react";

const TONES = {
  blue: { icon: "bg-blue-50 text-blue-700", value: "text-slate-900", hint: "text-slate-500" },
  red: { icon: "bg-red-50 text-red-600", value: "text-red-600", hint: "text-slate-500" },
  green: { icon: "bg-green-50 text-green-700", value: "text-slate-900", hint: "text-green-700" },
  amber: { icon: "bg-amber-50 text-amber-600", value: "text-amber-600", hint: "text-slate-500" },
} as const;

interface StatCardProps {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: string | number;
  hint: string;
}

export function StatCard({ icon: Icon, tone, label, value, hint }: StatCardProps) {
  const t = TONES[tone];
  return (
    <div className="flex min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${t.icon}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-700">{label}</p>
        <p className={`text-2xl font-bold ${t.value}`}>{value}</p>
        <p className={`truncate text-xs ${t.hint}`} title={hint}>
          {hint}
        </p>
      </div>
    </div>
  );
}
