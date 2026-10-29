import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/errors";
import { fetchLedgers, fetchSalesVoucherTypes } from "./masters";
import type { Company, Ledger } from "./types";

export interface Masters {
  /** "ready" stays while a refresh runs, so screens built on the ledgers do not flicker away. */
  status: "idle" | "loading" | "ready" | "error";
  refreshing: boolean;
  ledgers: Ledger[];
  voucherTypes: string[];
  error: string | null;
  reload: () => Promise<void>;
}

interface Loaded {
  company: string;
  ledgers: Ledger[];
  voucherTypes: string[];
}

const NONE: never[] = [];

/** Ledgers and sales voucher types of the selected company, read fresh from Tally. */
export function useMasters(url: string, company: Company | null): Masters {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<{ company: string; message: string } | null>(null);
  const latestRequest = useRef(0);
  const companyName = company?.name ?? null;

  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    if (!companyName) return;
    setRefreshing(true);
    try {
      const [ledgers, voucherTypes] = await Promise.all([fetchLedgers(url, companyName), fetchSalesVoucherTypes(url, companyName)]);
      if (request !== latestRequest.current) return;
      setLoaded({ company: companyName, ledgers: ledgers.sort((a, b) => a.name.localeCompare(b.name)), voucherTypes });
      setFailure(null);
    } catch (e) {
      if (request === latestRequest.current) setFailure({ company: companyName, message: errorMessage(e) });
    } finally {
      if (request === latestRequest.current) setRefreshing(false);
    }
  }, [url, companyName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const current = loaded?.company === companyName ? loaded : null;
  const error = failure?.company === companyName ? failure.message : null;
  let status: Masters["status"] = "loading";
  if (!companyName) status = "idle";
  else if (current) status = "ready";
  else if (error) status = "error";

  return {
    status,
    refreshing,
    ledgers: current?.ledgers ?? NONE,
    voucherTypes: current?.voucherTypes ?? NONE,
    error,
    reload,
  };
}
