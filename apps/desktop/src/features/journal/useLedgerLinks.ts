import { useCallback, useEffect, useState } from "react";
import type { Company } from "../tally/types";
import { ledgerKey } from "./journal";

const storageKey = (company: Company) => `th.journalLedgerLinks.${company.guid || company.name}`;

function load(company: Company | null): Record<string, string> {
  if (!company) return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey(company)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Remembers, per Tally company, which ledger a name in journal files means ("Salary A/c" →
 * "Salaries"), so the user links a name once and later files resolve on their own.
 */
export function useLedgerLinks(company: Company | null) {
  const [links, setLinks] = useState<Record<string, string>>(() => load(company));

  useEffect(() => setLinks(load(company)), [company]);

  const link = useCallback(
    (fileName: string, ledger: string) => {
      if (!company) return;
      setLinks((prev) => {
        const next = { ...prev, [ledgerKey(fileName)]: ledger };
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

  return { links, link };
}
