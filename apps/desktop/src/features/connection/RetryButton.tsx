import { RefreshCw } from "lucide-react";
import type { TallyConnection } from "./useTallyStatus";

const VARIANTS = {
  primary: "bg-blue-700 px-4 py-2 text-white hover:bg-blue-800",
  subtle: "border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50",
} as const;

interface RetryButtonProps {
  tally: TallyConnection;
  variant?: keyof typeof VARIANTS;
  className?: string;
}

/** Asks Tally again right away instead of waiting for the next background check. */
export function RetryButton({ tally, variant = "subtle", className = "" }: RetryButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void tally.recheck()}
      disabled={tally.checking}
      className={`inline-flex items-center gap-1.5 rounded-md text-sm font-medium disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      <RefreshCw size={14} className={tally.checking ? "animate-spin" : ""} />
      {tally.checking ? "Checking…" : "Retry"}
    </button>
  );
}
