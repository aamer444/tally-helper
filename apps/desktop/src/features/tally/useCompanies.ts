import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/errors";
import type { TallyConnection } from "../connection/useTallyStatus";
import { fetchCompanies } from "./masters";
import type { Company } from "./types";

const LAST_COMPANY_KEY = "tallyHelper.lastCompany";

function readLastCompany(): string | null {
  try {
    return localStorage.getItem(LAST_COMPANY_KEY);
  } catch {
    return null;
  }
}

export interface CompanyState {
  companies: Company[];
  selected: Company | null;
  error: string | null;
  select: (name: string) => void;
  reload: () => Promise<void>;
}

/** The companies open in Tally, refreshed whenever the connection comes back. */
export function useCompanies(tally: TallyConnection): CompanyState {
  const connected = "ok" in tally.status && tally.status.ok;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(readLastCompany);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const list = await fetchCompanies(tally.url);
      if (request !== latestRequest.current) return;
      setCompanies(list);
      setError(null);
    } catch (e) {
      if (request === latestRequest.current) setError(errorMessage(e));
    }
  }, [tally.url]);

  useEffect(() => {
    if (connected) void reload();
  }, [connected, reload]);

  const select = useCallback((name: string) => {
    setSelectedName(name);
    try {
      localStorage.setItem(LAST_COMPANY_KEY, name);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }, []);

  const selected = companies.find((c) => c.name === selectedName) ?? companies[0] ?? null;
  return { companies: connected ? companies : [], selected: connected ? selected : null, error, select, reload };
}
