import { ConnectionCheck } from "../connection/ConnectionCheck";
import type { TallyConnection } from "../connection/useTallyStatus";

export function HomePage({ tally }: { tally: TallyConnection }) {
  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome</h1>
        <p className="mt-1 text-slate-600">Upload → Map → Review → Push → Done</p>
      </div>
      <ConnectionCheck tally={tally} />
    </div>
  );
}
