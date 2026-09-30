import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { ActivitySnapshot } from "../types";

const REFRESH_MS = 2000;

/** Live CPU and memory, sampled while the Processes view is visible. */
export function useActivity({ paused }: { paused: boolean }) {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null);
  const [error, setError] = useState("");
  const sampling = useRef(false);
  const refresh = useCallback(async () => {
    if (!api.native || sampling.current) return;
    sampling.current = true;
    try {
      setSnapshot(await api.sampleActivity());
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      sampling.current = false;
    }
  }, []);
  useEffect(() => {
    const run = () => {
      if (!paused && document.visibilityState === "visible") void refresh();
    };
    run();
    const timer = setInterval(run, REFRESH_MS);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [paused, refresh]);
  return { snapshot, error, refresh };
}
