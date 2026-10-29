export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

const STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
  "97": "Other Territory",
};

const normaliseState = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

const CODE_BY_NAME = new Map<string, string>([
  ...Object.entries(STATES).map(([code, name]) => [normaliseState(name), code] as [string, string]),
  ["orissa", "21"], ["pondicherry", "34"], ["newdelhi", "07"],
]);

/** "27" gives "Maharashtra"; unknown codes give "". */
export const stateNameOf = (code: string): string => STATES[code] ?? "";

/** "Maharashtra", "27", "27-Maharashtra" and "Maharashtra (27)" all give "27". */
export function stateCodeOf(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const code = t.match(/^(\d{2})\b/)?.[1] ?? t.match(/\((\d{2})\)/)?.[1];
  if (code && STATES[code]) return code;
  return CODE_BY_NAME.get(normaliseState(t.replace(/\(\d{2}\)|^\d{2}\s*-?/g, ""))) ?? null;
}

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Format plus the official mod-36 check digit, so a typo in any character is caught. */
export function isValidGstin(gstin: string): boolean {
  if (!GSTIN_PATTERN.test(gstin)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(gstin[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === gstin[14];
}
