import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/errors";
import { fetchLedgers, fetchStockItems, fetchUnits, fetchVoucherTypes } from "./masters";
import type { Company, Ledger, StockItem } from "./types";

export interface Masters {
  /** "ready" stays while a refresh runs, so screens built on the ledgers do not flicker away. */
  status: "idle" | "loading" | "ready" | "error";
  refreshing: boolean;
  ledgers: Ledger[];
  voucherTypes: string[];
  stockItems: StockItem[];
  units: string[];
  error: string | null;
  reload: () => Promise<void>;
}

interface Loaded {
  company: string;
  ledgers: Ledger[];
  voucherTypes: string[];
  stockItems: StockItem[];
  units: string[];
}

const NONE: never[] = [];

/** Ledgers, stock items, units and the voucher types under `voucherParent` (e.g. "Sales"), read fresh from Tally. */
export function useMasters(url: string, company: Company | null, voucherParent: string): Masters {
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
      const [ledgers, voucherTypes, stockItems, units] = await Promise.all([
        fetchLedgers(url, companyName),
        fetchVoucherTypes(url, companyName, voucherParent),
        fetchStockItems(url, companyName),
        fetchUnits(url, companyName),
      ]);
      if (request !== latestRequest.current) return;
      setLoaded({ company: companyName, ledgers: ledgers.sort((a, b) => a.name.localeCompare(b.name)), voucherTypes, stockItems, units });
      setFailure(null);
    } catch (e) {
      if (request === latestRequest.current) setFailure({ company: companyName, message: errorMessage(e) });
    } finally {
      if (request === latestRequest.current) setRefreshing(false);
    }
  }, [url, companyName, voucherParent]);

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
    stockItems: current?.stockItems ?? NONE,
    units: current?.units ?? NONE,
    error,
    reload,
  };
}
