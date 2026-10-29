import { ArrowLeft, ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { formatPaise, formatTallyDate } from "../../lib/format";
import { cellText } from "../sales/import/fields";
import { columnLetter } from "../sales/import/import-file";
import { StepFooter } from "../sales/steps/StepFooter";
import { CARD, SELECT } from "../sales/steps/styles";
import {
  BANK_FIELDS,
  missingBankFields,
  statementHeaders,
  statementRows,
  withStatementHeader,
  type BalanceCheck,
  type BankFieldId,
  type StatementFile,
  type StatementRow,
} from "./statement";

const PREVIEW_ROWS = 6;

interface BankMapStepProps {
  file: StatementFile;
  onFileChange: (f: StatementFile) => void;
  rows: StatementRow[];
  balance: BalanceCheck;
  /** Why review cannot start yet (no bank ledger, company not read); empty when it can. */
  blockers: string[];
  onBack: () => void;
  onNext: () => void;
}

export function BankMapStep({ file, onFileChange, rows, balance, blockers, onBack, onNext }: BankMapStepProps) {
  const missing = missingBankFields(file.mapping);
  const problem = missing.length ? `Choose a column for: ${missing.join(", ")}` : !rows.length ? "No transactions found with these columns" : blockers[0];

  return (
    <>
      <div className="flex-1 space-y-4 px-6 pb-4">
        <div className="grid grid-cols-2 gap-4">
          <ColumnsCard file={file} onFileChange={onFileChange} />
          <div className="space-y-4">
            <BalanceCard balance={balance} rows={rows} />
            <PreviewCard rows={rows} />
          </div>
        </div>
      </div>
      <StepFooter info={problem ? <span className="text-amber-700">{problem}</span> : `${rows.length} transactions read from ${file.workbook.fileName}`}>
        <Button onClick={onBack}>
          <ArrowLeft size={16} /> Choose another file
        </Button>
        <Button variant="primary" disabled={Boolean(problem)} onClick={onNext}>
          Review lines <ArrowRight size={16} />
        </Button>
      </StepFooter>
    </>
  );
}

function ColumnsCard({ file, onFileChange }: { file: StatementFile; onFileChange: (f: StatementFile) => void }) {
  const headers = statementHeaders(file);
  const setColumn = (field: BankFieldId, value: string) => {
    const mapping = { ...file.mapping };
    if (value === "") delete mapping[field];
    else mapping[field] = Number(value);
    onFileChange({ ...file, mapping });
  };
  const sample = (col: number) => cellText(statementRows(file).slice(file.headerRow + 1).find((r) => cellText(r[col]))?.[col]);

  return (
    <section className={CARD}>
      <h2 className="font-semibold">Match your columns</h2>
      <p className="mt-1 text-sm text-slate-600">
        We guessed from the headings. Use Withdrawal and Deposit, or one Amount column with Dr/Cr.
      </p>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span>Headings are on row</span>
        <input
          type="number"
          min={1}
          max={statementRows(file).length}
          value={file.headerRow + 1}
          onChange={(e) => onFileChange(withStatementHeader(file, Math.max(0, Number(e.target.value) - 1)))}
          className="w-20 rounded-md border border-slate-200 px-2 py-1 outline-none focus:border-blue-500"
          aria-label="Heading row"
        />
      </div>
      <div className="mt-3 grid grid-cols-[140px_1fr_110px] items-center gap-x-3 gap-y-2 text-sm">
        {BANK_FIELDS.map((f) => {
          const col = file.mapping[f.id];
          return (
            <div key={f.id} className="contents">
              <span className={f.required ? "font-medium" : "text-slate-700"}>
                {f.label}
                {f.required && <span className="text-red-600"> *</span>}
              </span>
              <select aria-label={f.label} className={SELECT} value={col ?? ""} onChange={(e) => setColumn(f.id, e.target.value)}>
                <option value="">— Not in file —</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {columnLetter(i)} · {h || "(no heading)"}
                  </option>
                ))}
              </select>
              <span className="truncate text-xs text-slate-500" title={col === undefined ? "" : sample(col)}>
                {col === undefined ? "" : sample(col)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Opening + deposits − withdrawals must land on every printed balance, or a line was missed or misread. */
export function BalanceCard({ balance, rows }: { balance: BalanceCheck; rows: StatementRow[] }) {
  if (!rows.length) return null;
  if (!balance.checked) {
    return (
      <section className={`${CARD} text-sm text-slate-600`}>
        No Balance column, so we could not check that every line was read. Choose it on the left if the statement has one.
      </section>
    );
  }
  const ok = balance.breaks.length === 0;
  return (
    <section className={`${CARD} text-sm ${ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>
      <h2 className="flex items-center gap-2 font-semibold">
        {ok ? <CircleCheck size={16} /> : <TriangleAlert size={16} />}
        {ok ? "Balances check out" : `Balance does not follow on ${balance.breaks.length} line${balance.breaks.length > 1 ? "s" : ""}`}
      </h2>
      <p className="mt-1">
        Opening ₹{formatPaise(balance.opening)} + deposits ₹{formatPaise(balance.deposits)} − withdrawals ₹{formatPaise(balance.withdrawals)} = closing ₹
        {formatPaise(balance.closing)}
      </p>
      {!ok && (
        <ul className="mt-1 list-disc pl-5">
          {balance.breaks.slice(0, 3).map((b) => (
            <li key={b.rowNumber}>
              Row {b.rowNumber}: balance should be ₹{formatPaise(b.expected)} but the statement says ₹{formatPaise(b.found)}. A line above it may be missing
              or misread.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreviewCard({ rows }: { rows: StatementRow[] }) {
  return (
    <section className={CARD}>
      <h2 className="font-semibold">First lines, as we read them</h2>
      <table className="mt-2 w-full table-fixed text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="w-24 px-2 py-1.5 text-left font-medium">Date</th>
            <th className="px-2 py-1.5 text-left font-medium">Narration</th>
            <th className="w-24 px-2 py-1.5 text-right font-medium">Withdrawal</th>
            <th className="w-24 px-2 py-1.5 text-right font-medium">Deposit</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, PREVIEW_ROWS).map((r) => (
            <tr key={r.rowNumber} className="border-t border-slate-100">
              <td className="px-2 py-1 whitespace-nowrap">{r.date ? formatTallyDate(r.date) : <span className="text-red-700">{r.rawDate || "–"}</span>}</td>
              <td className="truncate px-2 py-1" title={r.narration}>
                {r.narration}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">{r.withdrawal ? formatPaise(r.withdrawal) : ""}</td>
              <td className="px-2 py-1 text-right tabular-nums">{r.deposit ? formatPaise(r.deposit) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
