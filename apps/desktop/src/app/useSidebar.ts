import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "th.sidebarOpen";

function savedOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** The sidebar's open/closed state: Ctrl+B toggles it, and the choice is kept for the next start. */
export function useSidebar(): { open: boolean; toggle: () => void } {
  const [open, setOpen] = useState(savedOpen);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // Not remembered next time; the toggle still works now.
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { open, toggle };
}
