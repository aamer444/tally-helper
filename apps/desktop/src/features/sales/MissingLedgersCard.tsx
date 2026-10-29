import { useState } from "react";
import { BookPlus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { errorMessage } from "../../lib/errors";
import type { InvoiceKind } from "./import/kind";
import type { Ledger } from "../tally/types";
import { ledgersFor, standardLedger, type LedgerRole } from "./import/standard-ledgers";

const CREATE = "";

/** For each missing role: an existing ledger to use, or CREATE for the standard one. */
export type LedgerFix = { role: LedgerRole; existing: string };

interface MissingLedgersCardProps {
  kind: InvoiceKind;
  roles: LedgerRole[];
  ledgers: Ledger[];
  companyName: string;
  onFix: (fixes: LedgerFix[]) => Promise<void>;
}

/**
 * A new company often has no purchase, GST, discount or round-off ledgers yet. Instead of
 * sending the user back to Tally, each one can be pointed at an existing ledger or created here.
 */
export function MissingLedgersCard({ kind, roles, ledgers, companyName, onFix }: MissingLedgersCardProps) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fix() {
    setBusy(true);
    setError(null);
    try {
      await onFix(roles.map((role) => ({ role, existing: choice[role] ?? CREATE })));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-5 rounded-md border border-blue-200 bg-blue-50 p-3">
      <h3 className="flex items-center gap-2 font-semibold text-blue-900">
        <BookPlus size={16} /> {roles.length === 1 ? "A ledger is" : `${roles.length} ledgers are`} missing in {companyName}
      </h3>
      <div className="mt-3 grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-2">
        {roles.map((role) => {
          const standard = standardLedger(kind, role);
          const existing = ledgersFor(role, ledgers);
          return (
            <div key={role} className="contents">
              <span className="text-slate-600">{role}</span>
              <select
                aria-label={`${role} ledger`}
                value={choice[role] ?? CREATE}
                onChange={(e) => setChoice((prev) => ({ ...prev, [role]: e.target.value }))}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-blue-500"
              >
                <option value={CREATE}>
                  Create "{standard.name}" ({standard.group})
                </option>
                {existing.length > 0 && (
                  <optgroup label="Or use an existing ledger">
                    {existing.map((l) => (
                      <option key={l.name}>{l.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-red-700">{error}</p>}
      <p className="mt-2 text-xs text-slate-600">Applies to every bill in this import.</p>
      <Button variant="primary" className="mt-2 px-3 py-1.5" disabled={busy} onClick={() => void fix()}>
        <BookPlus size={14} /> {busy ? "Setting up…" : "Fix ledgers"}
      </Button>
    </section>
  );
}
