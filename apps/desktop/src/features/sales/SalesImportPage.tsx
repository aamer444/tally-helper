import { useMemo, useState } from "react";
import { Stepper } from "../../components/ui/Stepper";
import { todayYmd } from "../../lib/dates";
import type { TallyConnection } from "../connection/useTallyStatus";
import type { Company } from "../tally/types";
import { useMasters } from "../tally/useMasters";
import { buildSalesVouchers, type SalesSettings, type SalesVoucher } from "./import/build-vouchers";
import { openSheet, sheetOf, type ImportFile } from "./import/import-file";
import { guessSettings } from "./import/settings";
import { MapStep } from "./steps/MapStep";
import { PushStep } from "./steps/PushStep";
import { ReviewStep } from "./steps/ReviewStep";
import { UploadStep } from "./steps/UploadStep";

const STEPS = ["Upload", "Map Columns", "Review & Validate", "Push to Tally"];
const [UPLOAD, MAP, REVIEW, PUSH] = [0, 1, 2, 3];

interface SalesImportPageProps {
  tally: TallyConnection;
  company: Company | null;
}

export function SalesImportPage({ tally, company }: SalesImportPageProps) {
  const masters = useMasters(tally.url, company);
  const [step, setStep] = useState(UPLOAD);
  const [file, setFile] = useState<ImportFile | null>(null);
  // Ledger choices belong to one company; switching company starts again from the guesses.
  const [overrides, setOverrides] = useState<{ company: string; values: Partial<SalesSettings> }>({ company: "", values: {} });
  // A snapshot: a busy Tally can miss a connection check mid-push, and that must not end the push.
  const [pushJob, setPushJob] = useState<{ vouchers: SalesVoucher[]; company: Company; voucherType: string } | null>(null);

  const settings = useMemo<SalesSettings>(
    () => ({
      ...guessSettings(masters.ledgers, masters.voucherTypes),
      ...(overrides.company === company?.name ? overrides.values : {}),
    }),
    [masters.ledgers, masters.voucherTypes, overrides, company?.name],
  );

  const vouchers = useMemo(() => {
    if (!file || !company || masters.status !== "ready") return [];
    return buildSalesVouchers({
      rows: sheetOf(file).rows,
      headerRow: file.headerRow,
      mapping: file.mapping,
      settings,
      company,
      ledgers: masters.ledgers,
      today: todayYmd(),
    });
  }, [file, company, masters.status, masters.ledgers, settings]);

  const changeSettings = (patch: Partial<SalesSettings>) =>
    setOverrides((prev) => ({
      company: company?.name ?? "",
      values: { ...(prev.company === company?.name ? prev.values : {}), ...patch },
    }));

  const startOver = () => {
    setFile(null);
    setPushJob(null);
    setStep(UPLOAD);
  };

  // Review needs the company's ledgers; fall back to mapping until they are available.
  const effectiveStep = step === REVIEW && (!company || masters.status !== "ready") ? MAP : step;

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-6 px-6 pt-6 pb-6">
        <div>
          <h1 className="text-3xl font-bold">Sales Import</h1>
          <p className="mt-1 text-slate-600">Import a sales register from Excel/CSV, check it against your Tally ledgers, and push it to Tally.</p>
        </div>
        <div className="px-16">
          <Stepper steps={STEPS} current={effectiveStep} />
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
          onLoaded={(workbook) => {
            setFile(openSheet(workbook));
            setStep(MAP);
          }}
        />
      )}
      {effectiveStep === MAP && file && (
        <MapStep
          file={file}
          onFileChange={setFile}
          settings={settings}
          onSettingsChange={changeSettings}
          masters={masters}
          onBack={startOver}
          onNext={() => setStep(REVIEW)}
        />
      )}
      {effectiveStep === REVIEW && file && (
        <ReviewStep
          vouchers={vouchers}
          file={file}
          voucherType={settings.voucherType}
          masters={masters}
          onBack={() => setStep(MAP)}
          onPush={(selected) => {
            if (!company) return;
            setPushJob({ vouchers: selected, company, voucherType: settings.voucherType });
            setStep(PUSH);
          }}
        />
      )}
      {effectiveStep === PUSH && pushJob && (
        <PushStep
          vouchers={pushJob.vouchers}
          company={pushJob.company}
          url={tally.url}
          voucherType={pushJob.voucherType}
          onBack={() => setStep(REVIEW)}
          onNewImport={startOver}
        />
      )}
    </div>
  );
}
