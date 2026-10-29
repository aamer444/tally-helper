import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { errorMessage } from "../../lib/errors";
import type { MissingItem } from "./import/build-vouchers";

interface CreateItemsCardProps {
  items: MissingItem[];
  units: string[];
  companyName: string;
  onCreate: (items: MissingItem[], unit: string) => Promise<void>;
}

/** Adds every product of a bill that Tally does not have, named exactly as the supplier prints it. */
export function CreateItemsCard({ items, units, companyName, onCreate }: CreateItemsCardProps) {
  const printedUnit = items.find((i) => i.unit)?.unit ?? "";
  // Use Tally's own spelling of the printed unit ("Pair" for "PAIR") when it has one.
  const [unit, setUnit] = useState(units.find((u) => u.toLowerCase() === printedUnit.toLowerCase()) ?? printedUnit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNewUnit = unit !== "" && !units.some((u) => u.toLowerCase() === unit.toLowerCase());

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await onCreate(items, unit.trim());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-5 rounded-md border border-blue-200 bg-blue-50 p-3">
      <h3 className="flex items-center gap-2 font-semibold text-blue-900">
        <PackagePlus size={16} /> {items.length} {items.length === 1 ? "product is" : "products are"} not in Tally
      </h3>
      <ul className="mt-2 max-h-36 list-disc overflow-y-auto pl-5 text-xs text-slate-700">
        {items.map((i) => (
          <li key={i.name}>{i.name}</li>
        ))}
      </ul>
      <label className="mt-3 flex items-center gap-2">
        <span className="text-slate-600">Unit</span>
        <input
          aria-label="Unit"
          list="tally-units"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 outline-none focus:border-blue-500"
        />
        <datalist id="tally-units">
          {units.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        {isNewUnit && <span className="text-xs text-slate-600">new unit, created too</span>}
      </label>
      {error && <p className="mt-2 text-red-700">{error}</p>}
      <p className="mt-2 text-xs text-slate-600">
        Creates them as stock items in <b>{companyName}</b>, named as on the bill. Tally's stock updates when the bill is pushed.
      </p>
      <Button variant="primary" className="mt-2 px-3 py-1.5" disabled={busy || !unit.trim()} onClick={() => void create()}>
        <PackagePlus size={14} /> {busy ? "Creating…" : `Create ${items.length} in Tally`}
      </Button>
    </section>
  );
}
