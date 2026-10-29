import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { parseDateCell } from "../../../lib/dates";
import { formatTallyDate } from "../../../lib/format";
import type { Masters } from "../../tally/useMasters";
import type { SalesSettings } from "../import/build-vouchers";
import { cellText, FIELDS, missingRequired, type FieldId } from "../import/fields";
import { columnLetter, headersOf, openSheet, sheetOf, withHeaderRow, type ImportFile } from "../import/import-file";
import { StepFooter } from "./StepFooter";

const PREVIEW_ROWS = 5;
const CARD = "rounded-lg border border-slate-200 bg-white p-5";
const SELECT = "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500";

interface MapStepProps {
  file: ImportFile;
  onFileChange: (file: ImportFile) => void;
  settings: SalesSettings;
  onSettingsChange: (patch: Partial<SalesSettings>) => void;
  masters: Masters;
  onBack: () => void;
  onNext: () => void;
}

export function MapStep({ file, onFileChange, settings, onSettingsChange, masters, onBack, onNext }: MapStepProps) {
  const missing = missingRequired(file.mapping);
  const blockers = [
    ...missing.map((m) => `Choose the column for ${m}`),
    ...(masters.status !== "ready" ? ["Ledgers have not been read from Tally yet"] : []),
    ...(masters.status === "ready" && !settings.salesLedger ? ["Choose the Sales ledger"] : []),
  ];

  return (
    <>
      <div className="flex-1 space-y-6 px-6 pb-6">
        <FileCard file={file} onFileChange={onFileChange} />
        <div className="grid gap-6 xl:grid-cols-2">
          <ColumnsCard file={file} onFileChange={onFileChange} />
          <LedgersCard settings={settings} onSettingsChange={onSettingsChange} masters={masters} />
        </div>
        <PreviewCard file={file} />
      </div>
      <StepFooter info={blockers[0] && <span className="text-amber-700">{blockers[0]}</span>}>
        <Button onClick={onBack}>
          <ArrowLeft size={16} /> Choose another file
        </Button>
        <Button variant="primary" disabled={blockers.length > 0} onClick={onNext}>
          Review vouchers <ArrowRight size={16} />
        </Button>
      </StepFooter>
    </>
  );
}

function FileCard({ file, onFileChange }: { file: ImportFile; onFileChange: (f: ImportFile) => void }) {
  const { sheets } = file.workbook;
  const dataRows = sheetOf(file).rows.length - file.headerRow - 1;
  return (
    <section className={`${CARD} flex flex-wrap items-center gap-x-8 gap-y-3 text-sm`}>
      <p>
        <span className="text-slate-500">File:</span> <b>{file.workbook.fileName}</b>
      </p>
      {sheets.length > 1 && (
        <label className="flex items-center gap-2">
          <span className="text-slate-500">Sheet</span>
          <select
            className={`${SELECT} w-auto`}
            value={file.sheetIndex}
            onChange={(e) => onFileChange(openSheet(file.workbook, Number(e.target.value)))}
          >
            {sheets.map((s, i) => (
              <option key={s.name} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2">
        <span className="text-slate-500">Headings are in row</span>
        <input
          type="number"
          min={1}
          max={sheetOf(file).rows.length}
          value={file.headerRow + 1}
          onChange={(e) => {
            const row = Number(e.target.value) - 1;
            if (row >= 0 && row < sheetOf(file).rows.length) onFileChange(withHeaderRow(file, row));
          }}
          className={`${SELECT} w-20`}
        />
      </label>
      <p className="text-slate-500">{dataRows} rows below the headings</p>
    </section>
  );
}

function sampleValue(file: ImportFile, col: number): string {
  const rows = sheetOf(file).rows.slice(file.headerRow + 1);
  return cellText(rows.find((r) => cellText(r[col]))?.[col]);
}

function ColumnsCard({ file, onFileChange }: { file: ImportFile; onFileChange: (f: ImportFile) => void }) {
  const headers = headersOf(file);
  const setColumn = (field: FieldId, value: string) => {
    const mapping = { ...file.mapping };
    if (value === "") delete mapping[field];
    else mapping[field] = Number(value);
    onFileChange({ ...file, mapping });
  };

  return (
    <section className={CARD}>
      <h2 className="font-semibold">Match your columns</h2>
      <p className="mt-1 text-sm text-slate-600">We guessed from the headings. Check each one; * is required.</p>
      <div className="mt-4 grid grid-cols-[150px_1fr_120px] items-center gap-x-3 gap-y-2 text-sm">
        {FIELDS.map((f) => {
          const col = file.mapping[f.id];
          return (
            <div key={f.id} className="contents">
              <span className={f.required ? "font-medium" : "text-slate-700"}>
                {f.label}
                {f.required && <span className="text-red-600"> *</span>}
              </span>
              <select className={SELECT} value={col ?? ""} onChange={(e) => setColumn(f.id, e.target.value)}>
                <option value="">— Not in file —</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {columnLetter(i)} · {h || "(no heading)"}
                  </option>
                ))}
              </select>
              <span className="truncate text-xs text-slate-500" title={col === undefined ? "" : sampleValue(file, col)}>
                {col === undefined ? "" : sampleValue(file, col)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const LEDGER_FIELDS: { key: keyof SalesSettings; label: string; hint: string }[] = [
  { key: "salesLedger", label: "Sales ledger *", hint: "Taxable value is credited here" },
  { key: "cgstLedger", label: "CGST ledger", hint: "Same-state sales" },
  { key: "sgstLedger", label: "SGST ledger", hint: "Same-state sales" },
  { key: "igstLedger", label: "IGST ledger", hint: "Other-state sales" },
  { key: "roundOffLedger", label: "Round off ledger", hint: "Up to ₹1 difference" },
];

function LedgersCard({ settings, onSettingsChange, masters }: Pick<MapStepProps, "settings" | "onSettingsChange" | "masters">) {
  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Tally ledgers</h2>
          <p className="mt-1 text-sm text-slate-600">Where each amount goes in Tally.</p>
        </div>
        <Button className="px-3 py-1.5" disabled={masters.refreshing} onClick={() => void masters.reload()}>
          <RefreshCw size={14} className={masters.refreshing ? "animate-spin" : ""} /> Refresh from Tally
        </Button>
      </div>

      {masters.status === "idle" && <p className="mt-4 text-sm text-amber-700">Open a company in Tally and select it at the top.</p>}
      {masters.status === "loading" && <p className="mt-4 text-sm text-slate-600">Reading ledgers from Tally…</p>}
      {masters.status === "error" && <p className="mt-4 text-sm text-red-700">{masters.error}</p>}

      {masters.status === "ready" && (
        <div className="mt-4 grid grid-cols-[150px_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span>Voucher type *</span>
          <select className={SELECT} value={settings.voucherType} onChange={(e) => onSettingsChange({ voucherType: e.target.value })}>
            {(masters.voucherTypes.length ? masters.voucherTypes : ["Sales"]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {LEDGER_FIELDS.map(({ key, label, hint }) => (
            <div key={key} className="contents">
              <span title={hint}>{label}</span>
              <select className={SELECT} value={settings[key]} onChange={(e) => onSettingsChange({ [key]: e.target.value })}>
                <option value="">— None —</option>
                {masters.ledgers.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                    {l.parent ? `  (${l.parent})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <p className="col-span-2 mt-1 text-xs text-slate-500">{masters.ledgers.length} ledgers read from Tally.</p>
        </div>
      )}
    </section>
  );
}

/** Dates are shown as we understood them, so a day/month mix-up is caught here. */
function previewCell(field: FieldId, value: unknown) {
  if (field !== "date" || cellText(value) === "") return cellText(value);
  const date = parseDateCell(value);
  return date ? formatTallyDate(date) : <span className="text-red-700">{cellText(value)} (not a date)</span>;
}

function PreviewCard({ file }: { file: ImportFile }) {
  const mapped = FIELDS.filter((f) => file.mapping[f.id] !== undefined);
  const rows = sheetOf(file).rows.slice(file.headerRow + 1, file.headerRow + 1 + PREVIEW_ROWS);
  return (
    <section className={CARD}>
      <h2 className="font-semibold">Preview (first {PREVIEW_ROWS} rows, as we read them)</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Row</th>
              {mapped.map((f) => (
                <th key={f.id} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-3 py-1.5 text-slate-500">{file.headerRow + i + 2}</td>
                {mapped.map((f) => (
                  <td key={f.id} className="px-3 py-1.5 whitespace-nowrap">
                    {previewCell(f.id, r[file.mapping[f.id]!])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
