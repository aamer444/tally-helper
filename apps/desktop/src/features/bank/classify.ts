import type { Ledger } from "../tally/types";
import { partyKey, similarity } from "../sales/import/party-match";

// Channel words and bank codes that say how money moved, not who it came from or went to.
const NOISE_WORDS = new Set(
  [
    "upi", "neft", "imps", "rtgs", "ach", "nach", "ecs", "mb", "ib", "inb", "inft", "mmt", "pos", "bil", "bill", "billpay", "by", "to", "from",
    "trf", "transfer", "tfr", "cr", "dr", "credit", "debit", "payment", "pmt", "paid", "rev", "txn", "ref", "utr", "chq", "cheque", "no",
    "sbin", "hdfc", "icic", "utib", "punb", "barb", "kkbk", "yesb", "idib", "cnrb", "ubin", "bkid", "mahb", "ibkl", "indb", "fdrl",
    "ybl", "paytm", "okaxis", "oksbi", "okicici", "okhdfcbank", "axl", "ibl", "apl",
  ],
);

/**
 * The part of a narration that names the other side, used to remember choices:
 * "UPI/DR/412345678901/ABC TRADERS/SBIN/abc@sbi" → "ABC TRADERS".
 */
export function narrationKey(narration: string): string {
  return narration
    .split(/[\s/\\|:;,_*#()[\]-]+/)
    .filter((t) => t && !/\d/.test(t) && !t.includes("@") && !NOISE_WORDS.has(t.toLowerCase().replace(/\.$/, "")))
    .join(" ")
    .toUpperCase()
    .trim();
}

/** The cheque number or UTR Tally's Bank Reconciliation matches on: the statement's own column first. */
export function instrumentOf(narration: string, refCell: string): { number: string; isCheque: boolean } {
  const cheque = narration.match(/\b(?:chq|cheque|clg)\b\D{0,6}(\d{6})\b/i);
  if (refCell && !/^0+$/.test(refCell)) {
    // Excel drops a cheque number's leading zeros (000123 → 123); the narration usually still has them.
    const number = cheque && cheque[1].endsWith(refCell) ? cheque[1] : refCell;
    return { number, isCheque: /^\d{6}$/.test(number) || Boolean(cheque) };
  }
  if (cheque) return { number: cheque[1], isCheque: true };
  const utr = narration.match(/\bUTR\s*[:.-]?\s*([A-Z0-9]{10,22})\b/i) ?? narration.match(/\b([A-Z]{4}[A-Z0-9]?\d{10,17}|\d{12,22})\b/i);
  return { number: utr?.[1] ?? "", isCheque: false };
}

export type Source = "learned" | "contra" | "rule" | "party" | "suspense";

export interface Classified {
  ledger: string;
  source: Source;
  /** 0 to 100; how sure the suggestion is. */
  confidence: number;
}

export interface ClassifyContext {
  bankLedger: string;
  ledgers: Ledger[];
  /** Narration key → the ledger the user chose for it before, in this company. */
  learned: ReadonlyMap<string, string>;
}

export const SUSPENSE: { name: string; group: string } = { name: "Suspense A/c", group: "Suspense A/c" };

const group = (l: Ledger) => l.parent.replace(/[\u0000-\u001f]/g, "").trim().toLowerCase();
const isBankOrCash = (l: Ledger) => ["bank accounts", "bank od a/c", "cash-in-hand"].includes(group(l));
const isParty = (l: Ledger) => ["sundry debtors", "sundry creditors"].includes(group(l));

const CASH = /\b(cash\s*(dep(osit)?|wdl|withdrawal|paid|recd)?|csh\s*dep|atm|atw|self)\b/i;

/** Narrations every bank writes the same way; each names a ledger group the money belongs to. */
const RULES: { test: RegExp; side: "withdrawal" | "deposit"; ledger: RegExp; standard: { name: string; group: string } }[] = [
  {
    test: /\b(bank\s*)?(charges?|chgs?|chrgs?)\b|\bsms\s*(alert|chg)|annual\s*(fee|maint)|\bmin(imum)?\s*bal|commission|\bamc\b|cheque\s*book|folio/i,
    side: "withdrawal",
    ledger: /bank\s*charges?/i,
    standard: { name: "Bank Charges", group: "Indirect Expenses" },
  },
  {
    test: /\bint(erest)?\b\.?\s*(cr|credit|pd|paid|on|recd)?\b|\binterest\b/i,
    side: "deposit",
    ledger: /interest/i,
    standard: { name: "Bank Interest Received", group: "Indirect Incomes" },
  },
];

/** Ledgers the classifier may suggest that a new company might not have yet, with their proper groups. */
export const STANDARD_BANK_LEDGERS = [...RULES.map((r) => r.standard), SUSPENSE, { name: "Cash", group: "Cash-in-Hand" }];

// A bank ledger's own name minus the words every bank ledger has: "HDFC CC A/c" → "hdfc".
const bankWords = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(a\/?c|account|bank|current|savings?|sb|ca|cc|od|ltd|limited|of|india|no\.?)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

const OWN_TRANSFER = /\b(self|own\s*a\/?c|own\s*account|fund\s*transfer)\b/i;

/**
 * Money moved to or from the company's own other bank or cash. Bank codes such as HDFC also appear
 * in other people's IFSC, so a bank's name counts only after the noise is removed, or with "self".
 */
function contraLedger(narration: string, ctx: ClassifyContext): string | null {
  const key = ` ${narrationKey(narration).toLowerCase()} `;
  const text = narration.toLowerCase();
  const others = ctx.ledgers.filter((l) => isBankOrCash(l) && l.name !== ctx.bankLedger);
  const bank = others.find((l) => {
    const words = bankWords(l.name);
    if (group(l) === "cash-in-hand" || !words.length) return false;
    return words.every((w) => key.includes(` ${w} `)) || (OWN_TRANSFER.test(narration) && words.some((w) => new RegExp(`\\b${w}\\b`).test(text)));
  });
  if (bank) return bank.name;
  if (CASH.test(narration)) return others.find((l) => group(l) === "cash-in-hand")?.name ?? "Cash";
  return null;
}

const MIN_CONTAINED = 4;

function partyLedger(key: string, ctx: ClassifyContext): { name: string; score: number } | null {
  const k = partyKey(key);
  if (k.length < 3) return null;
  let best: { name: string; score: number } | null = null;
  for (const l of ctx.ledgers.filter(isParty)) {
    const lk = partyKey(l.name);
    if (lk.length < 3) continue;
    // Containment needs a few letters, or a ledger like "ABC" would match every narration with "abc" in it.
    const contains = (lk.length >= MIN_CONTAINED && k.includes(lk)) || (k.length >= MIN_CONTAINED && lk.includes(k));
    const score = contains ? 0.95 : similarity(k, lk);
    if (score >= 0.6 && (!best || score > best.score)) best = { name: l.name, score };
  }
  return best;
}

/**
 * Suggests the other side of a bank line. First hit wins: what the user chose before for this
 * narration, a transfer with another bank or cash, a standard bank narration (charges, interest),
 * a party whose name appears in the narration, and otherwise Suspense for the user to decide.
 */
export function classify(narration: string, side: "withdrawal" | "deposit", ctx: ClassifyContext): Classified {
  const key = narrationKey(narration);
  const learned = key ? ctx.learned.get(key) : undefined;
  if (learned) return { ledger: learned, source: "learned", confidence: 95 };

  const contra = contraLedger(narration, ctx);
  if (contra) return { ledger: contra, source: "contra", confidence: 85 };

  const rule = RULES.find((r) => r.side === side && r.test.test(narration));
  if (rule) {
    const existing = ctx.ledgers.find((l) => rule.ledger.test(l.name) && !isParty(l) && !isBankOrCash(l));
    return { ledger: existing?.name ?? rule.standard.name, source: "rule", confidence: 80 };
  }

  const party = partyLedger(key, ctx);
  if (party) return { ledger: party.name, source: "party", confidence: Math.round(party.score * 85) };

  const suspense = ctx.ledgers.find((l) => group(l) === "suspense a/c")?.name ?? SUSPENSE.name;
  return { ledger: suspense, source: "suspense", confidence: 0 };
}

export const isBankOrCashLedger = isBankOrCash;
