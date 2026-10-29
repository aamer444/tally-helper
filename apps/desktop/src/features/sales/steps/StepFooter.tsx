import type { ReactNode } from "react";

/** Sticks to the bottom of the page so the next action is always in view. */
export function StepFooter({ info, children }: { info?: ReactNode; children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 flex items-center gap-6 border-t border-slate-200 bg-white px-6 py-4">
      <div className="min-w-0 flex-1 text-sm text-slate-600">{info}</div>
      <div className="flex gap-3">{children}</div>
    </footer>
  );
}
