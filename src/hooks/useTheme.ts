import { useEffect, useState } from "react";
import { applyWindowTheme, native } from "../api";
import type { ThemePreference } from "../types";

const KEY = "portlight.themePreference";
const LEGACY_KEY = "portlight.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "system" || value === "light" || value === "dark")
      return value;
    // Earlier versions always stored the theme; only dark was a choice.
    return localStorage.getItem(LEGACY_KEY) === "dark" ? "dark" : "system";
  } catch {
    return "system";
  }
}

function systemDark() {
  return window.matchMedia?.(DARK_QUERY).matches ?? false;
}

/** Light, dark or following macOS. */
export function useTheme() {
  const [preference, setPreference] = useState(readPreference);
  const [system, setSystem] = useState(systemDark);
  useEffect(() => {
    const media = window.matchMedia?.(DARK_QUERY);
    if (!media) return;
    const change = () => setSystem(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const dark = preference === "dark" || (preference === "system" && system);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    if (!native) return;
    const background = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    // The page keeps its own theme if the window cannot follow.
    applyWindowTheme(preference, background).catch(() => {});
  }, [dark, preference]);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, preference);
    } catch {
      // The preference is kept for this session only.
    }
  }, [preference]);
  return { preference, setPreference, dark };
}
