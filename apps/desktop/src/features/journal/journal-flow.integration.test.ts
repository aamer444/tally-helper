// @vitest-environment happy-dom
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { REPO_ROOT, startMockTally } from "../../test/mock-tally";
import { createLedger } from "../sales/import/create-party";
import { readWorkbook } from "../sales/import/read-sheet";
import { fetchCompanies, fetchLedgers } from "../tally/masters";
import { buildJournals, ledgerKey, openJournal, pushJournal, readJournal } from "./journal";

// The app talks to Tally through Tauri's HTTP plugin; in tests a plain Node request does the same job.
vi.mock("@tauri-apps/plugin-http", () => import("../../test/node-http-fetch"));

const PORT = 9913;
const URL = `http://localhost:${PORT}`;
const COMPANY = "Demo Traders - 2025-26";
let mock: ChildProcess;

beforeAll(async () => {
  mock = await startMockTally(PORT);
});

afterAll(() => {
  mock?.kill();
});

describe("journal import against the dummy Tally", () => {
  test("creates one missing ledger, links the other, and Tally accepts every balanced journal", async () => {
    const company = (await fetchCompanies(URL)).find((c) => c.name === COMPANY)!;
    const name = "journal-sample.csv";
    const rows = readJournal(openJournal(await readWorkbook(new File([readFileSync(resolve(REPO_ROOT, "fixtures", name))], name))));
    const build = async (links: Map<string, string>) =>
      buildJournals({ company, rows, byNumber: true, ledgers: await fetchLedgers(URL, COMPANY), links, today: "20251231" });

    expect((await build(new Map())).map((v) => v.status)).toEqual(["ready", "error", "ready", "error"]);

    await createLedger(URL, COMPANY, { name: "Salary Expenses", group: "Indirect Expenses" });
    const vouchers = await build(new Map([[ledgerKey("Salary Payable"), "Suspense A/c"]]));
    expect(vouchers.map((v) => v.status)).toEqual(["ready", "ready", "ready", "error"]);

    const ledgers = await fetchLedgers(URL, COMPANY);
    for (const v of vouchers.filter((x) => x.status === "ready")) {
      expect(await pushJournal(URL, COMPANY, "Journal", v, ledgers), v.voucherNo).toEqual({ state: "created" });
    }
    expect(await pushJournal(URL, COMPANY, "Journal", vouchers[0], ledgers)).toEqual({ state: "altered" });
  });
});
