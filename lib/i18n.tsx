"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { LANGUAGE_STORAGE_KEY, parseLanguage, translate, type Language, type Translate } from "./language";

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: Translate } | null>(null);

const languageEvent = "habitat-language-change";
let memoryLanguage: Language = "de";
let storageUnavailable = false;
function readLanguage(): Language {
  if (storageUnavailable) return memoryLanguage;
  try { return parseLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)); } catch { return memoryLanguage; }
}
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) onChange(); };
  window.addEventListener(languageEvent, onChange);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(languageEvent, onChange); window.removeEventListener("storage", onStorage); };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribe, readLanguage, () => "de" as const);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback((next: Language) => {
    memoryLanguage = next;
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); storageUnavailable = false; } catch { storageUnavailable = true; }
    window.dispatchEvent(new Event(languageEvent));
  }, []);
  const t = useCallback<Translate>((german, english) => translate(language, german, english), [language]);
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is required");
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return <label className="api-language">{t("Sprache", "Language")}
    <select value={language} onChange={(event) => setLanguage(parseLanguage(event.target.value))}>
      <option value="de" lang="de">Deutsch</option>
      <option value="en" lang="en">English</option>
    </select>
  </label>;
}
