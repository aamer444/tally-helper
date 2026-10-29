import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TALLY_URL, pingTally, type PingResult } from "./tally-ping";

const POLL_INTERVAL_MS = 15_000;

/** "checking" only until the first answer; after that the last known result stays on screen. */
export type TallyStatus = { state: "checking" } | PingResult;

export interface TallyConnection {
  status: TallyStatus;
  checking: boolean;
  url: string;
  recheck: () => Promise<void>;
}

/** One poller for the whole app; pass the result down instead of calling this twice. */
export function useTallyStatus(): TallyConnection {
  const [status, setStatus] = useState<TallyStatus>({ state: "checking" });
  const [checking, setChecking] = useState(false);
  const latestRequest = useRef(0);

  const recheck = useCallback(async () => {
    const request = ++latestRequest.current;
    setChecking(true);
    const result = await pingTally(DEFAULT_TALLY_URL);
    // A poll and a Retry click can overlap; only the newest answer may update the screen.
    if (request !== latestRequest.current) return;
    setStatus(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    void recheck();
    const timer = setInterval(() => void recheck(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [recheck]);

  return { status, checking, url: DEFAULT_TALLY_URL, recheck };
}

export function isDisconnected(status: TallyStatus): boolean {
  return "ok" in status && !status.ok;
}

export function describeStatus(status: TallyStatus): { label: string; dotClass: string } {
  if ("state" in status) return { label: "Checking Tally…", dotClass: "bg-slate-400" };
  return status.ok
    ? { label: "Tally Connected", dotClass: "bg-green-600" }
    : { label: "Tally Not Connected", dotClass: "bg-red-600" };
}
