export type ReviewStatus = "ready" | "warning" | "error";

const STYLES: Record<ReviewStatus, { label: string; badge: string; dot: string }> = {
  ready: { label: "Ready", badge: "bg-green-50 text-green-800", dot: "bg-green-600" },
  warning: { label: "Warning", badge: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  error: { label: "Error", badge: "bg-red-50 text-red-700", dot: "bg-red-600" },
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${s.badge}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
