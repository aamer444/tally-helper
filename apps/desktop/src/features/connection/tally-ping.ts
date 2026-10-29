import { fetch } from "@tauri-apps/plugin-http";

// `pnpm dev` talks to tools/tally-mock; `pnpm dev:real` and the installed app talk to real TallyPrime.
export const DEFAULT_TALLY_URL =
  import.meta.env.DEV && import.meta.env.MODE !== "real" ? "http://localhost:9900" : "http://localhost:9000";

const PING_TIMEOUT_MS = 3000;
const RUNNING_MARKER = "Server is Running";

export type PingResult = { ok: true } | { ok: false; reason: string };

/** GET / on Tally's XML server answers "TallyPrime Server is Running". */
export async function pingTally(url: string): Promise<PingResult> {
  try {
    // A busy Tally accepts the connection but may never answer, so time out the whole request.
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
    const body = await res.text();
    return body.includes(RUNNING_MARKER)
      ? { ok: true }
      : { ok: false, reason: "Something answered on this port, but it is not Tally." };
  } catch {
    return { ok: false, reason: "Tally is not reachable on this port." };
  }
}
