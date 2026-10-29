import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { Masters } from "../../tally/useMasters";
import type { InvoiceSettings } from "../import/build-vouchers";
import type { KindConfig } from "../import/kind";
import { supplierGstin } from "../pdf/bills";
import type { PdfBill } from "../pdf/parse-bill";
import { ledgerBlockers, LedgersCard } from "./LedgersCard";
import { StepFooter } from "./StepFooter";
import { CARD } from "./styles";

type EditableField = "supplierName" | "gstin" | "invoiceNo" | "date" | "taxable" | "cgst" | "sgst" | "igst" | "total";

const COLUMNS: { key: EditableField; label: string; width: string; amount?: boolean }[] = [
  { key: "supplierName", label: "Supplier", width: "w-52" },
  { key: "gstin", label: "Supplier GSTIN", width: "w-40" },
  { key: "invoiceNo", label: "Bill No", width: "w-32" },
  { key: "date", label: "Bill Date", width: "w-28" },
  { key: "taxable", label: "Taxable Value", width: "w-28", amount: true },
  { key: "cgst", label: "CGST", width: "w-24", amount: true },
  { key: "sgst", label: "SGST", width: "w-24", amount: true },
  { key: "igst", label: "IGST", width: "w-24", amount: true },
  { key: "total", label: "Bill Total", width: "w-28", amount: true },
];

/** Without these a bill cannot become a voucher; blank tax amounts are normal (CGST/SGST or IGST). */
const isMissing = (bill: PdfBill, key: EditableField) =>
  (key === "invoiceNo" || key === "date" || key === "total") && !bill[key].trim();

interface BillsStepProps {
  kind: KindConfig;
  bills: PdfBill[];
  onBillsChange: (bills: PdfBill[]) => void;
  settings: InvoiceSettings;
  onSettingsChange: (patch: Partial<InvoiceSettings>) => void;
  masters: Masters;
  onBack: () => void;
  onNext: () => void;
}

export function BillsStep({ kind, bills, onBillsChange, settings, onSettingsChange, masters, onBack, onNext }: BillsStepProps) {
  const knownGstins = new Set(masters.ledgers.map((l) => l.gstin).filter(Boolean));
  const blockers = ledgerBlockers(kind, settings, masters);
  const incomplete = bills.filter((b) => COLUMNS.some((c) => isMissing(b, c.key))).length;
  const update = (index: number, patch: Partial<PdfBill>) => onBillsChange(bills.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  return (
    <>
      <div className="flex-1 space-y-4 px-6 pb-4">
        <section className={CARD}>
          <h2 className="font-semibold">What we read from each bill</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every supplier lays out bills differently, so check these against the PDF and correct anything we misread. Amber boxes were not
            found on the bill.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">File</th>
                  <th className="px-2 py-2 text-right font-medium">Products</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={`px-2 py-2 font-medium whitespace-nowrap ${c.amount ? "text-right" : "text-left"}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills.map((bill, i) => (
                  <BillRow
                    key={`${i}-${bill.fileName}`}
                    listId={`bill-gstins-${i}`}
                    bill={bill}
                    resolvedGstin={supplierGstin(bill, knownGstins)}
                    onChange={(patch) => update(i, patch)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <LedgersCard kind={kind} settings={settings} onSettingsChange={onSettingsChange} masters={masters} />
      </div>
      <StepFooter
        info={
          blockers[0] ? (
            <span className="text-amber-700">{blockers[0]}</span>
          ) : incomplete ? (
            <span className="text-amber-700">{incomplete} bills have empty boxes; they will show as errors in review.</span>
          ) : undefined
        }
      >
        <Button onClick={onBack}>
          <ArrowLeft size={16} /> Choose other files
        </Button>
        <Button variant="primary" disabled={blockers.length > 0} onClick={onNext}>
          Review vouchers <ArrowRight size={16} />
        </Button>
      </StepFooter>
    </>
  );
}

interface BillRowProps {
  bill: PdfBill;
  listId: string;
  resolvedGstin: string;
  onChange: (patch: Partial<PdfBill>) => void;
}

function BillRow({ bill, listId, resolvedGstin, onChange }: BillRowProps) {
  return (
    <tr className="border-t border-slate-100">
      <td className="max-w-48 truncate px-2 py-1.5 text-slate-600" title={bill.fileName}>
        {bill.fileName}
      </td>
      <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums" title="Product lines read from the bill">
        {bill.items.lines.length || "–"}
      </td>
      {COLUMNS.map((c) => (
        <td key={c.key} className="px-1 py-1.5">
          <input
            aria-label={`${c.label} for ${bill.fileName}`}
            value={c.key === "gstin" ? bill.gstin || resolvedGstin : bill[c.key]}
            list={c.key === "gstin" ? listId : undefined}
            onChange={(e) => onChange({ [c.key]: c.key === "gstin" ? e.target.value.toUpperCase().trim() : e.target.value })}
            className={`${c.width} rounded-md border px-2 py-1 outline-none focus:border-blue-500 ${c.amount ? "text-right tabular-nums" : ""} ${
              isMissing(bill, c.key) ? "border-amber-400 bg-amber-50" : "border-slate-200"
            }`}
          />
          {c.key === "gstin" && (
            <datalist id={listId}>
              {bill.gstins.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          )}
        </td>
      ))}
    </tr>
  );
}
