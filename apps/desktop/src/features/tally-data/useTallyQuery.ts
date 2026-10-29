import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/errors";

export interface TallyQuery<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Runs `load` whenever `key` changes (e.g. company + period) and on reload().
 * A reply for an older key is dropped, so switching company never shows the previous company's data.
 */
export function useTallyQuery<T>(key: string | null, load: () => Promise<T>): TallyQuery<T> {
  const [result, setResult] = useState<{ key: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    const request = ++latest.current;
    if (!key) return;
    setLoading(true);
    loadRef
      .current()
      .then((data) => {
        if (request !== latest.current) return;
        setResult({ key, data });
        setFailure(null);
      })
      .catch((e: unknown) => {
        if (request === latest.current) setFailure({ key, message: errorMessage(e) });
      })
      .finally(() => {
        if (request === latest.current) setLoading(false);
      });
  }, [key]);

  useEffect(reload, [reload]);

  return {
    data: result?.key === key ? result.data : null,
    loading,
    error: failure?.key === key ? failure.message : null,
    reload,
  };
}
