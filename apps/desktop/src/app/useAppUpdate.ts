import { useEffect, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { errorMessage } from "../lib/errors";

export type UpdateState =
  | { status: "none" }
  | { status: "available"; version: string }
  | { status: "installing"; percent: number | null }
  | { status: "failed"; message: string };

// Only the installed app updates itself; `pnpm dev` and the browser preview have nothing to replace.
const canUpdate = () => import.meta.env.PROD && "__TAURI_INTERNALS__" in window;

/**
 * Looks once, at start-up, for a newer release on GitHub (signed with the project's key, see
 * tauri.conf.json). The user decides when to install; the app then restarts on the new version.
 */
export function useAppUpdate() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [state, setState] = useState<UpdateState>({ status: "none" });

  useEffect(() => {
    if (!canUpdate()) return;
    let cancelled = false;
    check()
      .then((found) => {
        if (cancelled || !found) return;
        setUpdate(found);
        setState({ status: "available", version: found.version });
      })
      // Offline or no release yet: nothing to offer, and nothing worth troubling the user with.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function install() {
    if (!update) return;
    let total = 0;
    let done = 0;
    setState({ status: "installing", percent: null });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          setState({ status: "installing", percent: total ? Math.round((done / total) * 100) : null });
        }
      });
      await relaunch();
    } catch (e) {
      setState({ status: "failed", message: errorMessage(e) });
    }
  }

  return { state, install };
}
