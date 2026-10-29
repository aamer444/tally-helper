import { useMemo, useState } from "react";
import { Stepper } from "../../components/ui/Stepper";
import { todayYmd } from "../../lib/dates";
import type { TallyConnection } from "../connection/useTallyStatus";
import type { Company } from "../tally/types";
import { useMasters } from "../tally/useMasters";
import { buildVouchers, type InvoiceSettings, type InvoiceVoucher } from "./import/build-vouchers";
import { createLedger, createPartyLedger } from "./import/create-party";
import { roleFor, SETTING_FOR, standardLedger, type LedgerKey, type LedgerRole } from "./import/standard-ledgers";
import { createStockItems, saveStockHsn } from "./import/create-stock";
import { usePartyAliases } from "./import/party-aliases";
import type { MasterActions } from "./VoucherPanel";
import { openSheet, sheetOf, type ImportFile } from "./import/import-file";
import { KINDS, type InvoiceKind, type KindConfig } from "./import/kind";
import { guessSettings } from "./import/settings";
import { pushVoucher } from "./import/push";
import { formatPaise } from "../../lib/format";
import { billsToImportFile } from "./pdf/bills";
import type { PdfBill } from "./pdf/parse-bill";
import { BillsStep } from "./steps/BillsStep";
import { MapStep } from "./steps/MapStep";
import { PushStep } from "./steps/PushStep";
import { ReviewStep } from "./steps/ReviewStep";
import { UploadStep } from "./steps/UploadStep";

const [UPLOAD, MAP, REVIEW, PUSH] = [0, 1, 2, 3];
const PARTY_GROUP: Record<KindConfig["side"], RegExp> = { sales: /^sundry debtors$/i, purchase: /^sundry creditors$/i };

/** An Excel/CSV register the user maps column by column, or PDF bills read one per voucher. */
type Source = { type: "sheet"; file: ImportFile } | { type: "pdf"; bills: PdfBill[] };

interface InvoiceImportPageProps {
  kind: InvoiceKind;
  tally: TallyConnection;
  company: Company | null;
}

export function InvoiceImportPage({ kind: kindId, tally, company }: InvoiceImportPageProps) {
  const kind = KINDS[kindId];
  const masters = useMasters(tally.url, company, kind.voucherParent);
  const { aliases, link: linkParty } = usePartyAliases(company);
  const [step, setStep] = useState(UPLOAD);
  const [moveToFirst, setMoveToFirst] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  // Ledger choices belong to one company; switching company starts again from the guesses.
  const [overrides, setOverrides] = useState<{ company: string; values: Partial<InvoiceSettings> }>({ company: "", values: {} });
  // A snapshot: a busy Tally can miss a connection check mid-push, and that must not end the push.
  const [pushJob, setPushJob] = useState<{ vouchers: InvoiceVoucher[]; company: Company; voucherType: string } | null>(null);

  const settings = useMemo<InvoiceSettings>(
    () => ({
      ...guessSettings(kind, masters.ledgers, masters.voucherTypes),
      ...(overrides.company === company?.name ? overrides.values : {}),
    }),
    [kind, masters.ledgers, masters.voucherTypes, overrides, company?.name],
  );

  // PDF bills are laid out as register rows, so review and push work the same for both sources.
  const file = useMemo(() => {
    if (!source) return null;
    return source.type === "sheet" ? source.file : billsToImportFile(source.bills, masters.ledgers);
  }, [source, masters.ledgers]);

  const vouchers = useMemo(() => {
    if (!file || !company || masters.status !== "ready") return [];
    return buildVouchers({
      kind: kindId,
      rows: sheetOf(file).rows,
      headerRow: file.headerRow,
      mapping: file.mapping,
      settings,
      company,
      ledgers: masters.ledgers,
      today: todayYmd(),
      items: file.items,
      stockItems: masters.stockItems,
      partyAliases: new Map(Object.entries(aliases)),
      educationalMode: masters.educational,
      moveToFirst,
    });
  }, [kindId, file, company, masters.status, masters.ledgers, masters.stockItems, masters.educational, settings, aliases, moveToFirst]);

  // Everything review can fix in Tally; reloading the masters rebuilds every voucher, so all bills
  // of a party or with those products turn ready together.
  /** Creates the standard ledger for `role` unless the company already has one by that name; returns its name. */
  async function ensureStandardLedger(role: LedgerRole): Promise<string> {
    const spec = standardLedger(kindId, role);
    const existing = masters.ledgers.find((l) => l.name.toLowerCase() === spec.name.toLowerCase());
    if (existing) return existing.name;
    await createLedger(tally.url, company!.name, spec);
    return spec.name;
  }

  const createLedgerFor = async (key: LedgerKey) => {
    const name = await ensureStandardLedger(roleFor(kindId, key));
    changeSettings({ [key]: name });
    await masters.reload();
  };

  const actions: MasterActions | null = company && {
    companyName: company.name,
    partyLedgers: masters.ledgers.filter((l) => PARTY_GROUP[kind.side].test(l.parent)).map((l) => l.name),
    units: masters.units,
    ledgers: masters.ledgers,
    fixLedgers: async (fixes) => {
      const patch: Partial<InvoiceSettings> = {};
      for (const { role, existing } of fixes) patch[SETTING_FOR[role]] = existing || (await ensureStandardLedger(role));
      changeSettings(patch);
      await masters.reload();
    },
    linkParty,
    createParty: async (party) => {
      await createPartyLedger(tally.url, company.name, party);
      await masters.reload();
    },
    createItems: async (items, unit) => {
      await createStockItems(tally.url, company.name, items, unit, masters.units);
      await masters.reload();
    },
    saveHsn: async (items) => {
      await saveStockHsn(tally.url, company.name, items);
      await masters.reload();
    },
  };

  const changeSettings = (patch: Partial<InvoiceSettings>) =>
    setOverrides((prev) => ({
      company: company?.name ?? "",
      values: { ...(prev.company === company?.name ? prev.values : {}), ...patch },
    }));

  const startOver = () => {
    setSource(null);
    setPushJob(null);
    setStep(UPLOAD);
  };

  // Review needs the company's ledgers; fall back to mapping until they are available.
  const effectiveStep = step === REVIEW && (!company || masters.status !== "ready") ? MAP : step;
  const steps = ["Upload", source?.type === "pdf" ? "Check Bills" : "Map Columns", "Review & Validate", "Push to Tally"];

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 px-6 pt-4 pb-4">
        <div>
          <h1 className="text-2xl font-bold">{kind.title}</h1>
          <p className="text-sm text-slate-600">{kind.intro}</p>
        </div>
        <div className="px-8">
          <Stepper steps={steps} current={effectiveStep} />
        </div>
        {!company && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            {"ok" in tally.status && tally.status.ok
              ? "No company is open in Tally. Open your company in TallyPrime; it will appear at the top."
              : "Tally is not connected. You can upload and map a file now; checking and pushing need Tally."}
          </p>
        )}
      </div>

      {effectiveStep === UPLOAD && (
        <UploadStep
          kind={kind}
          onWorkbook={(workbook) => {
            setSource({ type: "sheet", file: openSheet(workbook) });
            setStep(MAP);
          }}
          onBills={(bills) => {
            setSource({ type: "pdf", bills });
            setStep(MAP);
          }}
        />
      )}
      {effectiveStep === MAP && source?.type === "sheet" && (
        <MapStep
          kind={kind}
          file={source.file}
          onFileChange={(f) => setSource({ type: "sheet", file: f })}
          settings={settings}
          onSettingsChange={changeSettings}
          masters={masters}
          onCreateLedger={createLedgerFor}
          onBack={startOver}
          onNext={() => setStep(REVIEW)}
        />
      )}
      {effectiveStep === MAP && source?.type === "pdf" && (
        <BillsStep
          kind={kind}
          bills={source.bills}
          onBillsChange={(bills) => setSource({ type: "pdf", bills })}
          settings={settings}
          onSettingsChange={changeSettings}
          masters={masters}
          onCreateLedger={createLedgerFor}
          onBack={startOver}
          onNext={() => setStep(REVIEW)}
        />
      )}
      {effectiveStep === REVIEW && file && (
        <ReviewStep
          kind={kind}
          vouchers={vouchers}
          file={file}
          masters={masters}
          onBack={() => setStep(MAP)}
          actions={actions}
          moveToFirst={moveToFirst}
          onMoveToFirstChange={setMoveToFirst}
          onPush={(selected) => {
            if (!company) return;
            setPushJob({ vouchers: selected, company, voucherType: settings.voucherType });
            setStep(PUSH);
          }}
        />
      )}
      {effectiveStep === PUSH && pushJob && (
        <PushStep
          items={pushJob.vouchers}
          describe={(v) => ({ date: v.date, reference: v.invoiceNo, party: v.party, amount: v.total })}
          push={(v) => pushVoucher(tally.url, pushJob.company.name, pushJob.voucherType, v)}
          referenceLabel={kind.invoiceNoLabel}
          confirm={
            <>
              This will create <b>{pushJob.vouchers.length}</b> {kind.documentWord} vouchers worth{" "}
              <b>₹{formatPaise(pushJob.vouchers.reduce((n, v) => n + v.total, 0))}</b> in the Tally company <b>{pushJob.company.name}</b>, using voucher
              type <b>{pushJob.voucherType}</b>.
            </>
          }
          onBack={() => setStep(REVIEW)}
          onNewImport={startOver}
        />
      )}
    </div>
  );
}
