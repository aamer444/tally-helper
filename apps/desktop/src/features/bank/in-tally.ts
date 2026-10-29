import { fetchVouchers, type VoucherRow } from "../tally-data/tally-data";
import type { StatementRow } from "./statement";

const DAY_MS = 86_400_000;
/** Banks post a cheque or transfer a day or two after the accountant entered it. */
const DATE_SLACK_DAYS = 2;

const toTime = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)));
const daysApart = (a: string, b: string) => Math.abs(toTime(a) - toTime(b)) / DAY_MS;
const shift = (ymd: string, days: number) => new Date(toTime(ymd) + days * DAY_MS).toISOString().slice(0, 10).replace(/-/g, "");

/** The statement's dates widened by the slack, so vouchers entered a little earlier or later are read too. */
export function statementPeriod(rows: StatementRow[]): { from: string; to: string } | null {
  const dates = rows.map((r) => r.date).filter((d): d is string => Boolean(d)).sort();
  if (!dates.length) return null;
  return { from: shift(dates[0], -DATE_SLACK_DAYS), to: shift(dates[dates.length - 1], DATE_SLACK_DAYS) };
}

/**
 * Statement lines that already have a voucher on this bank ledger in Tally: same side, same amount,
 * dated within two days. Each voucher is used once, closest date first, so two equal payments on
 * nearby days match two vouchers rather than one.
 */
export function matchInTally(rows: StatementRow[], vouchers: VoucherRow[], bankLedger: string): Map<number, VoucherRow> {
  // Tally signs amounts: a negative line is a debit, i.e. money coming into the bank.
  const candidates = vouchers
    .filter((v) => !v.cancelled)
    .flatMap((v) => v.lines.filter((l) => l.ledger === bankLedger && l.amount !== 0).map((l) => ({ v, deposit: l.amount < 0, amount: Math.abs(l.amount) })));
  const used = new Set<VoucherRow>();
  const matches = new Map<number, VoucherRow>();

  for (const row of rows) {
    if (!row.date) continue;
    const amount = row.deposit || row.withdrawal;
    const best = candidates
      .filter((c) => !used.has(c.v) && c.deposit === row.deposit > 0 && c.amount === amount && daysApart(c.v.date, row.date!) <= DATE_SLACK_DAYS)
      .sort((a, b) => daysApart(a.v.date, row.date!) - daysApart(b.v.date, row.date!))[0];
    if (best) {
      used.add(best.v);
      matches.set(row.rowNumber, best.v);
    }
  }
  return matches;
}

/** Reads the period's vouchers from Tally and matches them against the statement. Read-only. */
export async function findInTally(url: string, company: string, rows: StatementRow[], bankLedger: string): Promise<Map<number, VoucherRow>> {
  const period = statementPeriod(rows);
  if (!period) return new Map();
  return matchInTally(rows, await fetchVouchers(url, company, period.from, period.to), bankLedger);
}
