import { createContext, useContext, type ReactNode } from "react";
import { en, messages, type Language, type Messages } from "./messages";

export { LANGUAGES, messages, type Language, type Messages } from "./messages";

const I18n = createContext<Messages>(en);

export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <I18n.Provider value={messages[language] ?? en}>{children}</I18n.Provider>
  );
}

/** Texts of the current language (English outside a provider). */
export function useT() {
  return useContext(I18n);
}

const KEY = "portlight.language";

/** Last language used, to render the first frame before settings load. */
export function cachedLanguage(): Language {
  try {
    return localStorage.getItem(KEY) === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

export function cacheLanguage(language: Language) {
  try {
    localStorage.setItem(KEY, language);
  } catch {
    // The language still comes from the saved settings.
  }
}
