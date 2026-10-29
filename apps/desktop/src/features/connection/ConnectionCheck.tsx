import { RetryButton } from "./RetryButton";
import type { TallyConnection } from "./useTallyStatus";

export function ConnectionCheck({ tally }: { tally: TallyConnection }) {
  const { status, url } = tally;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">Connection to Tally</h2>
      <p className="mt-1 text-sm text-slate-500">{url}</p>

      {"state" in status && <p className="mt-4 text-slate-600">Checking…</p>}

      {"ok" in status && status.ok && (
        <p className="mt-4 font-medium text-green-700">✓ Connected to TallyPrime</p>
      )}

      {"ok" in status && !status.ok && (
        <div className="mt-4">
          <p className="font-medium text-red-700">✗ {status.reason}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Open TallyPrime and load your company.</li>
            <li>
              Press <kbd className="rounded border px-1">F1</kbd> (Help) → Settings → Connectivity.
            </li>
            <li>
              Set <b>TallyPrime acts as</b> to <b>Both</b> and <b>Port</b> to <b>9000</b>.
            </li>
            <li>Come back here and click Retry.</li>
          </ol>
        </div>
      )}

      <RetryButton tally={tally} variant="primary" className="mt-5" />
    </section>
  );
}
