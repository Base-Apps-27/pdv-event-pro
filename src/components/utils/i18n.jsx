/**
 * i18n.jsx — Internationalization provider and hook.
 * 
 * Split file architecture (2026-03-02):
 *   - Translation strings live in i18n/en.js and i18n/es.js
 *   - This file provides LanguageProvider context + useLanguage hook
 *   - liveFallback map covers live.* keys that may be missing from split files
 * 
 * Safe defaults: useLanguage returns fallback values if called outside provider
 * to prevent unrecoverable crashes (see P3-FIX comment below).
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { safeGetItem, safeSetItem } from '@/components/utils/safeLocalStorage';
import { en } from './i18n/en';
import { es } from './i18n/es';

const translations = {
  en,
  es,
};

// Defensive fallback map for live.* keys when a translation is missing
const liveFallback = {
  // New LiveDirectorPanel translations
  'live.manual_mode': { es: 'Modo Manual', en: 'Manual Mode' },
  'live.manual_instructions': { es: 'Haz clic en cualquier hora para editar. "Marcar Terminado" establece la hora de fin a AHORA e inicia el siguiente segmento.', en: 'Click any time to edit. "Mark Ended" sets end time to NOW and starts the next segment.' },
  'live.segment': { es: 'Segmento', en: 'Segment' },
  'live.planned': { es: 'Planificado', en: 'Planned' },
  'live.actual': { es: 'Actual', en: 'Actual' },
  'live.start': { es: 'Inicio', en: 'Start' },
  'live.end': { es: 'Fin', en: 'End' },
  'live.time_updated': { es: 'Hora actualizada', en: 'Time updated' },
};

// Normalize language codes like 'es-ES', 'en-US' to base keys we support
function normalizeLang(lang) {
  if (!lang) return 'es';
  const l = String(lang).toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('es')) return 'es';
  return 'es';
}

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLangState] = useState(() => {
    const stored = safeGetItem('language', 'es');
    return normalizeLang(stored);
  });

  // Phase 1 i18n rollout: prefer user.ui_language when authenticated; otherwise fallback to localStorage
  useEffect(() => {
    (async () => {
      const authed = await base44.auth.isAuthenticated();
      if (authed) {
        const user = await base44.auth.me();
        const pref = user?.ui_language ? normalizeLang(user.ui_language) : null;
        if (pref && pref !== language) {
          setLangState(pref);
          safeSetItem('language', pref);
        }
      }
    })();
  }, []);

  // Wrapper that persists locally, tracks analytics, and saves to user profile if logged in
  const setLanguage = (lang) => {
    const norm = normalizeLang(lang);
    setLangState(norm);
    safeSetItem('language', norm);
    base44.analytics.track({ eventName: 'language_changed', properties: { lang: norm } });
    base44.auth.isAuthenticated().then((authed) => {
      if (authed) {
        base44.auth.updateMe({ ui_language: norm });
      }
    });
  };

  const t = (key) => {
    const lang = normalizeLang(language);
    const direct = translations[lang]?.[key];
    if (direct) return direct;
    // Fallback: support dotted keys like "live.manual_mode" when missing from translations
    if (typeof key === 'string' && liveFallback[key]) {
      return liveFallback[key][lang] || liveFallback[key]['es'] || key;
    }
    return key; // final fallback shows the key to surface missing strings in dev
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // P3-FIX (2026-03-02): Return safe defaults instead of throwing.
    // Throwing here is unrecoverable by ErrorBoundary — it crashes the entire tree
    // because React can't re-render hooks that throw during recovery.
    // This fallback ensures navigation and basic rendering survive even if
    // LanguageProvider is missing or errored.
    console.error('[useLanguage] Called outside LanguageProvider — returning safe defaults');
    return {
      language: 'es',
      setLanguage: () => {},
      t: (key) => key,
    };
  }
  return context;
}