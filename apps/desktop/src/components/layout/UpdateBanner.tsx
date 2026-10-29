import { Download } from "lucide-react";
import type { UpdateState } from "../../app/useAppUpdate";
import { Button } from "../ui/Button";

/** One plain line when a newer version is out; nothing at all otherwise. */
export function UpdateBanner({ state, onInstall }: { state: UpdateState; onInstall: () => void }) {
  if (state.status === "none") return null;
  return (
    <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-6 py-2 text-sm text-blue-900">
      <Download size={16} className="shrink-0" />
      {state.status === "available" && (
        <>
          <span>
            A new version of Tally Helper (<b>{state.version}</b>) is ready. Updating takes a minute and restarts the app.
          </span>
          <Button variant="primary" className="ml-auto px-3 py-1" onClick={onInstall}>
            Update now
          </Button>
        </>
      )}
      {state.status === "installing" && <span>Updating{state.percent === null ? "…" : ` ${state.percent}%`} The app will restart on its own.</span>}
      {state.status === "failed" && (
        <>
          <span className="text-red-800">The update did not finish ({state.message}). Close the app, open it again and try once more.</span>
          <Button className="ml-auto px-3 py-1" onClick={onInstall}>
            Try again
          </Button>
        </>
      )}
    </div>
  );
}
