import { useEffect, useMemo, useState } from "react";
import { Stepper } from "../../components/ui/Stepper";
import { errorMessage } from "../../lib/errors";
import { todayYmd } from "../../lib/dates";
import { formatPaise } from "../../lib/format";
import type { TallyConnection } from "../connection/useTallyStatus";
import { createLedger } from "../sales/import/create-party";
import { PushStep } from "../sales/steps/PushStep";
import type { VoucherRow } from "../tally-data/tally-data";
import type { Company } from "../tally/types";
import { useMasters } from "../tally/useMasters";
import { buildBankEntries, pushBankEntry, type BankEntry } from "./bank-vouchers";
import { BankMapStep } from "./BankMapStep";
import { BankReviewStep, type InTallyState } from "./BankReviewStep";
import { BankUploadStep } from "./BankUploadStep";
import { STANDARD_BANK_LEDGERS } from "./classify";
import { findInTally } from "./in-tally";
import { useLearnedLedgers } from "./learned";
import { checkBalances, openStatement, readStatement, type StatementFile } from "./statement";

const [UPLOAD, MAP, REVIEW, PUSH] = [0, 1, 2, 3];
const STEPS = ["Upload", "Map Columns", "Review & Classify", "Push to Tally"];
const BANK_GROUP = /^(bank accounts|bank od a\/c)$/i;

interface BankImportPageProps {
  tally: TallyConnection;
  company: Company | null;
}

export function BankImportPage({ tally, company }: BankImportPageProps) {
  const masters = useMasters(tally.url, company, "Payment");
  const { learned, learn } = useLearnedLedgers(company);
  const [step, setStep] = useState(UPLOAD);
  const [chosenBank, setChosenBank] = useState("");
  const [file, setFile] = useState<StatementFile | null>(null);
  const [overrides, setOverrides] = useState<ReadonlyMap<number, string>>(new Map());
  const [moveToFirst, setMoveToFirst] = useState(false);
  const [inTally, setInTally] = useState<{ state: InTallyState; matches: ReadonlyMap<number, VoucherRow> }>({ state: { status: "loading" }, matches: new Map() });
  const [tallyCheck, setTallyCheck] = useState(0);
  // A snapshot: a busy Tally can miss a connection check mid-push, and that must not end the push.
  const [pushJob, setPushJob] = useState<{ entries: BankEntry[]; company: Company; bankLedger: string } | null>(null);

  const bankLedgers = masters.ledgers.filter((l) => BANK_GROUP.test(l.parent));
  const bankLedger = bankLedgers.some((l) => l.name === chosenBank) ? chosenBank : (bankLedgers[0]?.name ?? "");
  const rows = useMemo(() => (file ? readStatement(file) : []), [file]);
  const balance = useMemo(() => checkBalances(rows), [rows]);

  // Lines already entered in Tally are found again whenever review opens or the user asks.
  useEffect(() => {
    if (step !== REVIEW || !company || !bankLedger || !rows.length) return;
    let cancelled = false;
    setInTally((prev) => ({ ...prev, state: { status: "loading" } }));
    findInTally(tally.url, company.name, rows, bankLedger)
      .then((matches) => !cancelled && setInTally({ state: { status: "ready" }, matches }))
      .catch((e: unknown) => !cancelled && setInTally({ state: { status: "error", error: errorMessage(e) }, matches: new Map() }));
    return () => {
      cancelled = true;
    };
  }, [step, company, bankLedger, rows, tally.url, tallyCheck]);

  const entries = useMemo(() => {
    if (!company || masters.status !== "ready" || !bankLedger) return [];
    return buildBankEntries({
      company,
      bankLedger,
      rows,
      ledgers: masters.ledgers,
      learned: new Map(Object.entries(learned)),
      overrides,
      inTally: inTally.matches,
      today: todayYmd(),
      educationalMode: masters.educational,
      moveToFirst,
    });
  }, [company, masters.status, masters.ledgers, masters.educational, bankLedger, rows, learned, overrides, inTally.matches, moveToFirst]);

  const startOver = () => {
    setFile(null);
    setOverrides(new Map());
    setPushJob(null);
    setStep(UPLOAD);
  };

  async function createBankLedger(name: string) {
    await createLedger(tally.url, company!.name, { name, group: "Bank Accounts" });
    setChosenBank(name);
    await masters.reload();
  }

  async function createLedgers(names: string[]) {
    for (const name of names) {
      const spec = STANDARD_BANK_LEDGERS.find((s) => s.name === name);
      if (spec) await createLedger(tally.url, company!.name, spec);
    }
    await masters.reload();
  }

  const blockers = !company ? ["Select the company at the top"] : masters.status !== "ready" ? ["Ledgers have not been read from Tally yet"] : !bankLedger ? ["Choose or create the bank ledger in step 1"] : [];
  const effectiveStep = step === REVIEW && blockers.length ? MAP : step;

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 px-6 pt-4 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Bank Statement Import</h1>
          <p className="text-sm text-slate-600">
            Turn a bank statement into receipts, payments and contras, skipping lines already in Tally and remembering your choices.
          </p>
        </div>
        <div className="px-8">
          <Stepper steps={STEPS} current={effectiveStep} />
        </div>
        {!company && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            {"ok" in tally.status && tally.status.ok
              ? "No company is open in Tally. Open your company in TallyPrime; it will appear at the top."
              : "Tally is not connected. You can upload and map a statement now; classifying and pushing need Tally."}
          </p>
        )}
      </div>

      {effectiveStep === UPLOAD && (
        <BankUploadStep
          bankLedgers={bankLedgers}
          bankLedger={bankLedger}
          onBankLedgerChange={setChosenBank}
          onCreateBankLedger={createBankLedger}
          ready={masters.status === "ready"}
          onWorkbook={(workbook) => {
            setFile(openStatement(workbook));
            setOverrides(new Map());
            setStep(MAP);
          }}
        />
      )}
      {effectiveStep === MAP && file && (
        <BankMapStep file={file} onFileChange={setFile} rows={rows} balance={balance} blockers={blockers} onBack={startOver} onNext={() => setStep(REVIEW)} />
      )}
      {effectiveStep === REVIEW && (
        <BankReviewStep
          entries={entries}
          rows={rows}
          balance={balance}
          bankLedger={bankLedger}
          ledgers={masters.ledgers}
          inTally={inTally.state}
          onRecheckTally={() => setTallyCheck((n) => n + 1)}
          onChoose={(entry, ledger) => {
            setOverrides((prev) => new Map(prev).set(entry.row.rowNumber, ledger));
            learn(entry.key, ledger);
          }}
          onCreateLedgers={createLedgers}
          educational={masters.educational}
          moveToFirst={moveToFirst}
          onMoveToFirstChange={setMoveToFirst}
          onBack={() => setStep(MAP)}
          onPush={(selected) => {
            if (!company) return;
            setPushJob({ entries: selected, company, bankLedger });
            setStep(PUSH);
          }}
        />
      )}
      {effectiveStep === PUSH && pushJob && (
        <PushStep
          items={pushJob.entries}
          describe={(e) => ({ date: e.date, reference: e.instrument.number || `Row ${e.row.rowNumber}`, party: `${e.type} · ${e.ledger}`, amount: e.amount })}
          push={(e) => pushBankEntry(tally.url, pushJob.company.name, e, pushJob.bankLedger, masters.ledgers)}
          referenceLabel="Cheque / UTR"
          confirm={
            <>
              This will create <b>{pushJob.entries.length}</b> vouchers worth <b>₹{formatPaise(pushJob.entries.reduce((n, e) => n + e.amount, 0))}</b> on{" "}
              <b>{pushJob.bankLedger}</b> in the Tally company <b>{pushJob.company.name}</b> (
              {(["Receipt", "Payment", "Contra"] as const)
                .map((t) => `${pushJob.entries.filter((e) => e.type === t).length} ${t.toLowerCase()}`)
                .join(", ")}
              ).
            </>
          }
          onBack={() => setStep(REVIEW)}
          onNewImport={startOver}
        />
      )}
    </div>
  );
}
