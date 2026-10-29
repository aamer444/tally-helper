import { useCallback, useEffect, useState } from "react";
import type { Company } from "../tally/types";

const storageKey = (company: Company) => `th.bankLearned.${company.guid || company.name}`;

function load(company: Company | null): Record<string, string> {
  if (!company) return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey(company)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Remembers, per Tally company, the ledger chosen for a narration ("ABC TRADERS" → "ABC Traders"),
 * so the same name on later lines and later statements is classified on its own.
 */
export function useLearnedLedgers(company: Company | null) {
  const [learned, setLearned] = useState<Record<string, string>>(() => load(company));

  useEffect(() => setLearned(load(company)), [company]);

  const learn = useCallback(
    (key: string, ledger: string) => {
      if (!company || !key) return;
      setLearned((prev) => {
        const next = { ...prev, [key]: ledger };
        try {
          localStorage.setItem(storageKey(company), JSON.stringify(next));
        } catch {
          // Not saved for next time; the choice still applies for this session.
        }
        return next;
      });
    },
    [company],
  );

  return { learned, learn };
}
