import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { ActivitySnapshot } from "../types";
import { addSample, type CpuSample } from "../activity";

const REFRESH_MS = 2000;

/** Live CPU and memory, sampled while the Processes view is visible. With
 *  `history`, the last two minutes of CPU are kept for the guide. */
export function useActivity({
  paused,
  history: keep,
}: {
  paused: boolean;
  history: boolean;
}) {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null);
  const [history, setHistory] = useState<CpuSample[]>([]);
  const keeping = useRef(keep);
  keeping.current = keep;
  const [error, setError] = useState("");
  const sampling = useRef(false);
  const refresh = useCallback(async () => {
    if (!api.native || sampling.current) return;
    sampling.current = true;
    try {
      const next = await api.sampleActivity();
      setSnapshot(next);
      setHistory((h) => (keeping.current ? addSample(h, next) : []));
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
  return { snapshot, history, error, refresh };
}
