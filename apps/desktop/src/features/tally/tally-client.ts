import { fetch } from "@tauri-apps/plugin-http";
import { parseXml } from "../../lib/xml";

const DEFAULT_TIMEOUT_MS = 30_000;

export class TallyUnreachableError extends Error {
  constructor() {
    super("Could not reach Tally. Check that TallyPrime is open, then try again.");
  }
}

/** Sends one XML request to Tally's HTTP server and returns the parsed reply. */
export async function postToTally(url: string, xml: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Document> {
  let body: string;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: xml,
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await res.text();
  } catch {
    throw new TallyUnreachableError();
  }
  return parseXml(body);
}
