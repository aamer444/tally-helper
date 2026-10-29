import { useCallback, useEffect, useState } from "react";
import type { Company } from "../../tally/types";
import { partyKey } from "./party-match";

const storageKey = (company: Company) => `th.partyAliases.${company.guid || company.name}`;

function load(company: Company | null): Record<string, string> {
  if (!company) return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey(company)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Remembers, per Tally company, which ledger a party name on bills belongs to ("KGN" → "kgn1"),
 * so the user links a name once and later bills match on their own.
 */
export function usePartyAliases(company: Company | null) {
  const [aliases, setAliases] = useState<Record<string, string>>(() => load(company));

  useEffect(() => setAliases(load(company)), [company]);

  const link = useCallback(
    (nameOnBill: string, ledger: string) => {
      if (!company) return;
      setAliases((prev) => {
        const next = { ...prev, [partyKey(nameOnBill)]: ledger };
        try {
          localStorage.setItem(storageKey(company), JSON.stringify(next));
        } catch {
          // Not saved for next time; the link still applies for this session.
        }
        return next;
      });
    },
    [company],
  );

  return { aliases, link };
}
