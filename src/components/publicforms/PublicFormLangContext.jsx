/**
 * PublicFormLangContext.jsx
 * 
 * Language context for public forms. Provides ES/EN toggle state
 * persisted to localStorage. Default: 'es'.
 * 
 * 2026-02-28: Created to replace inline bilingual duplication on all public forms.
 * Decision: "Public Form Language Toggle" — single-language display, user-controlled.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const PublicFormLangContext = createContext({ lang: 'es', setLang: () => {}, t: (es, en) => es });

const STORAGE_KEY = 'pdv_public_form_lang';

export function PublicFormLangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'es'; } catch { return 'es'; }
  });

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  // t(spanish, english) — returns correct string for current language
  const t = useCallback((es, en) => lang === 'en' ? en : es, [lang]);

  return (
    <PublicFormLangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </PublicFormLangContext.Provider>
  );
}

export function usePublicLang() {
  return useContext(PublicFormLangContext);
}