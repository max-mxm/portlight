import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import { cacheLanguage, cachedLanguage } from "../i18n";
import { DEFAULT_REVIEW_HOURS } from "../services";
import type { Settings } from "../types";

export const defaultSettings = (): Settings => ({
  reviewHours: DEFAULT_REVIEW_HOURS,
  projectRoots: [],
  devBinaries: [],
  editor: null,
  language: cachedLanguage(),
});

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
  useEffect(() => cacheLanguage(settings.language), [settings.language]);
  const save = useCallback(async (next: Settings) => {
    // The web interface keeps its settings in memory only.
    const saved = api.native ? await api.saveSettings(next) : next;
    setSettings(saved);
    return saved;
  }, []);
  return { settings, save };
}
