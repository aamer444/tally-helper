import { useState } from "react";
import { CircleAlert, TriangleAlert, X } from "lucide-react";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatPaise, formatTallyDate } from "../../lib/format";
import { CreateItemsCard } from "./CreateItemsCard";
import { CreatePartyCard } from "./CreatePartyCard";
import type { InvoiceVoucher, MissingItem } from "./import/build-vouchers";
import { newPartyFor, type NewParty } from "./import/create-party";
import { cellText } from "./import/fields";
import { voucherXml } from "./import/voucher-xml";

type Tab = "Summary" | "Products" | "Source Rows" | "XML";

/** What review can fix in Tally without leaving the app; absent when no company is open. */
export interface MasterActions {
  companyName: string;
  /** Customer/supplier ledger names, for linking a party that bills spell differently. */
  partyLedgers: string[];
  units: string[];
  linkParty: (nameOnBill: string, ledger: string) => void;
  createParty: (party: NewParty) => Promise<void>;
  createItems: (items: MissingItem[], unit: string) => Promise<void>;
}

interface VoucherPanelProps {
  voucher: InvoiceVoucher;
  headers: string[];
  sheetRows: unknown[][];
  voucherType: string;
  actions: MasterActions | null;
  onClose: () => void;
}

export function VoucherPanel({ voucher, headers, sheetRows, voucherType, actions, onClose }: VoucherPanelProps) {
  const [tab, setTab] = useState<Tab>("Summary");
  const tabs: Tab[] = voucher.items.length ? ["Summary", "Products", "Source Rows", "XML"] : ["Summary", "Source Rows", "XML"];

  return (
    <aside className="sticky top-4 flex max-h-[calc(100vh-12rem)] w-[360px] shrink-0 flex-col rounded-lg border border-slate-200 bg-white 2xl:w-[420px]">
      <div className="flex items-center gap-3 px-5 pt-4">
        <h2 className="truncate text-xl font-bold">{voucher.invoiceNo || "(no invoice no)"}</h2>
        <StatusBadge status={voucher.status} />
        <button type="button" aria-label="Close" onClick={onClose} className="ml-auto text-slate-500">
          <X size={18} />
        </button>
      </div>

      <div className="mt-3 flex gap-4 border-b border-slate-200 px-5 text-sm whitespace-nowrap">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2 ${t === tab ? "border-blue-700 font-semibold text-blue-700" : "border-transparent text-slate-600"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto p-5 text-sm">
        {tab === "Summary" && (
          <>
            {voucher.partyMissing && actions && (
              <CreatePartyCard
                key={voucher.partyOnBill}
                initial={newPartyFor(voucher)}
                nameOnBill={voucher.partyOnBill}
                suggestions={voucher.partySuggestions}
                partyLedgers={actions.partyLedgers}
                companyName={actions.companyName}
                onLink={(ledger) => actions.linkParty(voucher.partyOnBill, ledger)}
                onCreate={actions.createParty}
              />
            )}
            {voucher.missingItems.length > 0 && actions && (
              <CreateItemsCard
                key={voucher.id}
                items={voucher.missingItems}
                units={actions.units}
                companyName={actions.companyName}
                onCreate={actions.createItems}
              />
            )}
            <Summary voucher={voucher} />
          </>
        )}
        {tab === "Products" && <Products voucher={voucher} />}
        {tab === "Source Rows" && <SourceRows voucher={voucher} headers={headers} sheetRows={sheetRows} />}
        {tab === "XML" && (
          <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
            {voucherXml(voucher, voucherType)}
          </pre>
        )}
      </div>
    </aside>
  );
}

function Products({ voucher }: { voucher: InvoiceVoucher }) {
  const missing = new Set(voucher.missingItems.map((i) => i.name));
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50 text-slate-700">
        <tr>
          <th className="px-2 py-1.5 text-left font-medium">Product</th>
          <th className="px-2 py-1.5 text-right font-medium">Qty</th>
          <th className="px-2 py-1.5 text-right font-medium">Rate</th>
          <th className="px-2 py-1.5 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {voucher.items.map((i, n) => (
          <tr key={n} className="border-t border-slate-100">
            <td className={`px-2 py-1 ${missing.has(i.name) ? "text-red-700" : ""}`}>{i.name}</td>
            <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">
              {i.qty} {i.unit}
            </td>
            <td className="px-2 py-1 text-right tabular-nums">{i.rate.toFixed(2)}</td>
            <td className="px-2 py-1 text-right tabular-nums">{formatPaise(i.amount)}</td>
          </tr>
        ))}
        {voucher.discount > 0 && (
          <tr className="border-t border-slate-200">
            <td colSpan={3} className="px-2 py-1 text-slate-600">
              Less: discount
            </td>
            <td className="px-2 py-1 text-right tabular-nums">−{formatPaise(voucher.discount)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Issues({ voucher }: { voucher: InvoiceVoucher }) {
  if (!voucher.issues.length) return null;
  return (
    <ul className="mb-5 space-y-2">
      {voucher.issues.map((issue, i) => {
        const Icon = issue.level === "error" ? CircleAlert : TriangleAlert;
        return (
          <li
            key={i}
            className={`flex gap-2 rounded-md p-2 ${issue.level === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            {issue.message}
          </li>
        );
      })}
    </ul>
  );
}

function Summary({ voucher }: { voucher: InvoiceVoucher }) {
  const fields: [string, string][] = [
    ["Date", voucher.date ? formatTallyDate(voucher.date) : "–"],
    ["Party", voucher.party || "–"],
    ["GSTIN", voucher.gstin || "–"],
    ["Place of Supply", voucher.placeOfSupply || "–"],
    ["Narration", voucher.narration],
    ["Rows in file", voucher.rowNumbers.join(", ")],
  ];

  return (
    <>
      <Issues voucher={voucher} />
      <dl className="grid grid-cols-[120px_1fr] gap-y-2">
        {fields.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-6 font-semibold">Voucher Preview (Tally)</h3>
      <LedgerTable voucher={voucher} />
    </>
  );
}

function LedgerTable({ voucher }: { voucher: InvoiceVoucher }) {
  const sum = (key: "debit" | "credit") => voucher.lines.reduce((acc, l) => acc + l[key], 0);
  const cell = (paise: number) => (paise === 0 ? "–" : formatPaise(paise));

  return (
    <table className="mt-3 w-full border border-slate-200 text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Ledger</th>
          <th className="px-3 py-2 text-right font-medium">Debit (₹)</th>
          <th className="px-3 py-2 text-right font-medium">Credit (₹)</th>
        </tr>
      </thead>
      <tbody>
        {voucher.lines.map((l) => (
          <tr key={l.role} className="border-t border-slate-100">
            <td className="px-3 py-1.5">{l.ledger || <span className="text-red-700">({l.role} ledger not chosen)</span>}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{cell(l.debit)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{cell(l.credit)}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
          <td className="px-3 py-2">Total</td>
          <td className="px-3 py-2 text-right tabular-nums">{formatPaise(sum("debit"))}</td>
          <td className="px-3 py-2 text-right tabular-nums">{formatPaise(sum("credit"))}</td>
        </tr>
      </tbody>
    </table>
  );
}

function SourceRows({ voucher, headers, sheetRows }: Pick<VoucherPanelProps, "voucher" | "headers" | "sheetRows">) {
  return (
    <div className="space-y-4">
      {voucher.rowNumbers.map((n) => (
        <div key={n}>
          <p className="font-semibold">Row {n}</p>
          <dl className="mt-1 grid grid-cols-[120px_1fr] gap-y-1">
            {headers.map((h, i) => {
              const value = cellText(sheetRows[n - 1]?.[i]);
              return value ? (
                <div key={i} className="contents">
                  <dt className="truncate text-slate-500">{h || `Column ${i + 1}`}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ) : null;
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
