import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { Snapshot } from "../types";

const REFRESH_MS = 10000;

/** Inventory from the backend, refreshed while the window is visible. */
export function useInventory({
  paused,
  busy,
}: {
  paused: boolean;
  busy: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const scanning = useRef(false);
  const latest = useRef<Snapshot | null>(null);
  const accept = useCallback((next: Snapshot) => {
    latest.current = next;
    setSnapshot(next);
    setError("");
  }, []);
  /** Resolves with the new snapshot, or the current one if a scan is running. */
  const refresh = useCallback(async (): Promise<Snapshot | null> => {
    if (!api.native || scanning.current) return latest.current;
    scanning.current = true;
    setLoading(true);
    try {
      const next = await api.scan();
      accept(next);
      return next;
    } catch (e) {
      setError(String(e));
      return latest.current;
    } finally {
      scanning.current = false;
      setLoading(false);
    }
  }, [accept]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const active = () =>
      !paused && !busy && document.visibilityState === "visible";
    const timer = setInterval(() => {
      setNow(Date.now());
      if (active()) void refresh();
    }, REFRESH_MS);
    const visible = () => {
      if (active()) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [paused, busy, refresh]);
  useEffect(() => {
    if (!api.native) return;
    const unlisten = api.onSnapshot(accept);
    return () => void unlisten.then((stop) => stop());
  }, [accept]);
  return { snapshot, loading, error, refresh, now, latest };
}
