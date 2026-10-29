// @vitest-environment happy-dom
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, startMockTally } from "../../test/mock-tally";
import { createLedger } from "../sales/import/create-party";
import { readWorkbook } from "../sales/import/read-sheet";
import { fetchCompanies, fetchLedgers } from "../tally/masters";
import { buildBankEntries, pushBankEntry } from "./bank-vouchers";
import { STANDARD_BANK_LEDGERS } from "./classify";
import { findInTally } from "./in-tally";
import { openStatement, readStatement } from "./statement";

// The app talks to Tally through Tauri's HTTP plugin; in tests a plain Node request does the same job.
vi.mock("@tauri-apps/plugin-http", () => import("../../test/node-http-fetch"));

const PORT = 9912;
const URL = `http://localhost:${PORT}`;
const COMPANY = "Demo Traders - 2025-26";
const BANK = "SBI Current A/c";
let mock: ChildProcess;

beforeAll(async () => {
  mock = await startMockTally(PORT);
});

afterAll(() => {
  mock?.kill();
});

describe("bank statement import against the dummy Tally", () => {
  test("skips what Tally has, sets up the missing ledger, and Tally accepts every other line", async () => {
    const company = (await fetchCompanies(URL)).find((c) => c.name === COMPANY)!;
    const name = "bank-statement-sample.csv";
    const rows = readStatement(openStatement(await readWorkbook(new File([readFileSync(resolve(REPO_ROOT, "fixtures", name))], name))));

    const inTally = await findInTally(URL, COMPANY, rows, BANK);
    expect([...inTally.keys()]).toEqual([10]);

    const build = async () =>
      buildBankEntries({
        company, bankLedger: BANK, rows, ledgers: await fetchLedgers(URL, COMPANY), learned: new Map(), overrides: new Map(), inTally, today: "20251231",
      });
    const before = await build();
    expect(before.find((e) => e.row.rowNumber === 10)?.status).toBe("in-tally");
    expect(before.filter((e) => e.status === "error").map((e) => e.ledger)).toEqual(["Bank Interest Received"]);

    await createLedger(URL, COMPANY, STANDARD_BANK_LEDGERS.find((s) => s.name === "Bank Interest Received")!);
    const after = await build();
    const toPush = after.filter((e) => e.status === "ready" || e.status === "warning");
    expect(toPush).toHaveLength(7);

    const ledgers = await fetchLedgers(URL, COMPANY);
    for (const entry of toPush) {
      expect(await pushBankEntry(URL, COMPANY, entry, BANK, ledgers), entry.row.narration).toEqual({ state: "created" });
    }
    // Pushing the same statement again updates those vouchers instead of entering them twice.
    expect(await pushBankEntry(URL, COMPANY, toPush[0], BANK, ledgers)).toEqual({ state: "altered" });
  });
});
