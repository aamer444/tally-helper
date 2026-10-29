import type { Ledger } from "../../tally/types";

const MAX_SUGGESTIONS = 5;
const MIN_SIMILARITY = 0.5;
const PARTY_GROUPS = /^sundry (creditors|debtors)$/i;
const NOISE = /\b(m\/s\.?|messrs\.?|the|pvt|private|ltd|limited|llp|co|company|and|&)\b/g;

/** "M/s. KGN Traders Pvt Ltd" and "kgn traders" compare as the same text. */
export const partyKey = (name: string) => name.toLowerCase().replace(NOISE, " ").replace(/[^a-z0-9]/g, "");

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/** 1 for the same name, near 1 for "KGN" vs "kgn1" or "KGN Traders", near 0 for unrelated names. */
export function similarity(a: string, b: string): number {
  const x = partyKey(a);
  const y = partyKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.startsWith(y) || y.startsWith(x)) return 0.9;
  return 1 - editDistance(x, y) / Math.max(x.length, y.length);
}

/**
 * Party ledgers whose names look like `name`, closest first, for the user to choose from.
 * Never applied on its own: "KGN" and "KGN Footwear" may well be different businesses.
 */
export function suggestParties(name: string, ledgers: Ledger[]): string[] {
  return ledgers
    .filter((l) => PARTY_GROUPS.test(l.parent))
    .map((l) => ({ name: l.name, score: similarity(name, l.name) }))
    .filter((s) => s.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.name);
}
