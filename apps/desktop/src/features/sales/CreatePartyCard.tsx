import { useState } from "react";
import { Link2, UserPlus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { errorMessage } from "../../lib/errors";
import type { NewParty } from "./import/create-party";
import { isValidGstin, stateNameOf } from "./import/gst";

const INPUT = "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-blue-500";

interface CreatePartyCardProps {
  initial: NewParty;
  nameOnBill: string;
  suggestions: string[];
  /** Every customer/supplier ledger, for when the right one is not among the suggestions. */
  partyLedgers: string[];
  companyName: string;
  onLink: (ledger: string) => void;
  onCreate: (party: NewParty) => Promise<void>;
}

/**
 * Bills spell a party's name their own way ("KGN" for "kgn1"), so the user either links the
 * name to the existing ledger (remembered for later bills) or creates a new one.
 */
export function CreatePartyCard({ initial, nameOnBill, suggestions, partyLedgers, companyName, onLink, onCreate }: CreatePartyCardProps) {
  const others = partyLedgers.filter((l) => !suggestions.includes(l));
  const [existing, setExisting] = useState(suggestions[0] ?? "");
  const [name, setName] = useState(initial.name);
  const [gstin, setGstin] = useState(initial.gstin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badGstin = gstin !== "" && !isValidGstin(gstin);
  const stateName = stateNameOf(gstin.slice(0, 2));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), group: initial.group, gstin, stateName });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-5 space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
      <div>
        <h3 className="flex items-center gap-2 font-semibold text-blue-900">
          <Link2 size={16} /> Already in Tally under another name?
        </h3>
        <div className="mt-2 flex gap-2">
          <select aria-label="Existing ledger" value={existing} onChange={(e) => setExisting(e.target.value)} className={INPUT}>
            <option value="">— Choose a ledger —</option>
            {suggestions.length > 0 && (
              <optgroup label="Similar names">
                {suggestions.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </optgroup>
            )}
            <optgroup label={`All ${initial.group.toLowerCase()}`}>
              {others.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </optgroup>
          </select>
          <Button className="px-3 py-1.5" disabled={!existing} onClick={() => onLink(existing)}>
            Use
          </Button>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Remembered for this company: later bills from "{nameOnBill}" go to the chosen ledger.
        </p>
      </div>

      <div className="border-t border-blue-200 pt-3">
        <h3 className="flex items-center gap-2 font-semibold text-blue-900">
          <UserPlus size={16} /> Or create it in Tally
        </h3>
        <div className="mt-2 grid grid-cols-[70px_1fr] items-center gap-x-2 gap-y-2">
          <span className="text-slate-600">Name</span>
          <input aria-label="Ledger name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          <span className="text-slate-600">GSTIN</span>
          <input
            aria-label="GSTIN"
            value={gstin}
            placeholder="Leave empty if unregistered"
            onChange={(e) => setGstin(e.target.value.toUpperCase().trim())}
            className={`${INPUT} ${badGstin ? "border-red-400" : ""}`}
          />
          <span className="text-slate-600">State</span>
          <span>{stateName || "–"}</span>
          <span className="text-slate-600">Group</span>
          <span>{initial.group}</span>
        </div>
        {badGstin && <p className="mt-2 text-red-700">This GSTIN is not valid. Check it or leave it empty.</p>}
        {error && <p className="mt-2 text-red-700">{error}</p>}
        <p className="mt-2 text-xs text-slate-600">
          Creates the ledger in <b>{companyName}</b> with bill-wise details on.
        </p>
        <Button variant="primary" className="mt-2 px-3 py-1.5" disabled={busy || !name.trim() || badGstin} onClick={() => void create()}>
          <UserPlus size={14} /> {busy ? "Creating…" : "Create in Tally"}
        </Button>
      </div>
    </section>
  );
}
