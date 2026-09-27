import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import { DEFAULT_REVIEW_HOURS } from "../services";
import type { Settings } from "../types";

export const defaultSettings: Settings = {
  reviewHours: DEFAULT_REVIEW_HOURS,
  projectRoots: [],
  devBinaries: [],
  editor: null,
};

/** Settings stored by the backend, shared with the scan. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  useEffect(() => {
    if (!api.native) return;
    api
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);
  }, []);
  const save = useCallback(async (next: Settings) => {
    const saved = await api.saveSettings(next);
    setSettings(saved);
    return saved;
  }, []);
  return { settings, save };
}
