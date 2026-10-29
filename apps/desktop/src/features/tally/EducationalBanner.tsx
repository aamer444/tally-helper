import { TriangleAlert } from "lucide-react";

interface EducationalBannerProps {
  moveToFirst: boolean;
  onMoveToFirstChange: (on: boolean) => void;
}

/** Unlicensed Tally takes only the 1st, 2nd and 31st; the user can practise by entering on the 1st. */
export function EducationalBanner({ moveToFirst, onMoveToFirstChange }: EducationalBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <TriangleAlert size={16} className="shrink-0" />
      <span>
        Tally is in <b>Educational mode</b> (no licence), so it only takes vouchers dated the 1st, 2nd or 31st of a month.
      </span>
      <label className="ml-auto flex shrink-0 items-center gap-2 font-medium">
        <input type="checkbox" checked={moveToFirst} onChange={(e) => onMoveToFirstChange(e.target.checked)} className="size-4 accent-amber-700" />
        Enter on the 1st (practice only)
      </label>
    </div>
  );
}
