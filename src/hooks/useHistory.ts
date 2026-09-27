import { useCallback, useEffect, useState } from "react";
import type { Activity } from "../types";

const KEY = "portlight.history";
const LIMIT = 50;

export function readHistory(): Activity[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (item): item is Activity =>
              typeof item?.id === "string" &&
              typeof item?.name === "string" &&
              Array.isArray(item?.ports) &&
              item.ports.every((port: unknown) => typeof port === "number") &&
              typeof item?.at === "number" &&
              typeof item?.message === "string" &&
              typeof item?.success === "boolean",
          )
          .slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}

/** Last stops performed in Portlight, kept in local storage. */
export function useHistory() {
  const [activity, setActivity] = useState<Activity[]>(readHistory);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(activity));
    } catch {
      // Storage unavailable: the history stays in memory.
    }
  }, [activity]);
  const record = useCallback((entry: Omit<Activity, "id" | "at">) => {
    setActivity((items) =>
      [{ id: crypto.randomUUID(), at: Date.now(), ...entry }, ...items].slice(
        0,
        LIMIT,
      ),
    );
  }, []);
  const clear = useCallback(() => setActivity([]), []);
  return { activity, record, clear };
}
