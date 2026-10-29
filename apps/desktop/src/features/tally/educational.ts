import { formatTallyDate } from "../../lib/format";

const EDUCATIONAL_DAYS = ["01", "02", "31"];

export interface DateRules {
  /** Tally runs unlicensed (Educational mode) and takes vouchers dated only the 1st, 2nd or 31st. */
  educationalMode?: boolean;
  /** In Educational mode, enter each voucher on the 1st of its month instead, for practice. */
  moveToFirst?: boolean;
  booksFrom: string;
}

export interface DateIssue {
  level: "error" | "warning";
  message: string;
}

/** Unlicensed Tally drops any other date and then reports the voucher's date as missing. */
export function educationalDate(date: string | null, rules: DateRules): { date: string | null; issue?: DateIssue } {
  if (!rules.educationalMode || !date || EDUCATIONAL_DAYS.includes(date.slice(6))) return { date };
  const firstOfMonth = `${date.slice(0, 6)}01`;
  if (!rules.moveToFirst || (rules.booksFrom && firstOfMonth < rules.booksFrom)) {
    return {
      date,
      issue: {
        level: "error",
        message: 'Tally is in Educational mode (no licence) and only takes dates on the 1st, 2nd or 31st of a month. Activate your licence, or tick "Enter on the 1st" above to practise.',
      },
    };
  }
  return {
    date: firstOfMonth,
    issue: { level: "warning", message: `Entered on ${formatTallyDate(firstOfMonth)} instead of ${formatTallyDate(date)} (Tally Educational mode)` },
  };
}
