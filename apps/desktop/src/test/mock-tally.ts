import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

export const REPO_ROOT = resolve(__dirname, "../../../..");

/** Starts tools/tally-mock on `port` and resolves once it is listening. */
export async function startMockTally(port: number): Promise<ChildProcess> {
  const mock = spawn(process.execPath, [resolve(REPO_ROOT, "tools/tally-mock/server.mjs")], {
    env: { ...process.env, TALLY_MOCK_PORT: String(port) },
  });
  await new Promise<void>((ready, fail) => {
    mock.stdout?.on("data", (d: Buffer) => d.toString().includes("listening") && ready());
    mock.on("error", fail);
  });
  return mock;
}
