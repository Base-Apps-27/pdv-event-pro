import { useState, useEffect } from 'react';

const THEME_STORAGE_KEY = 'ui_theme';
const VALID_THEMES = ['light', 'dark', 'system'];

/**
 * Durable dark mode hook with iOS PWA support
 * 
 * Features:
 * - localStorage persistence ('light' | 'dark' | 'system')
 * - matchMedia listener for reactive system preference changes (web)
 * - Polling fallback (10 sec) for iOS PWA limited reactivity
 * - Applies theme class to <html> element
 * 
 * Usage:
 *   const { theme, setTheme, isSystemPreference } = useTheme();
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // Initialize from localStorage or default to 'system'
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return VALID_THEMES.includes(stored) ? stored : 'system';
  });

  const [isSystemPreference, setIsSystemPreference] = useState(false);
  const [pollingId, setPollingId] = useState(null);

  // Determine actual theme (resolve 'system' to 'light' or 'dark')
  const getResolvedTheme = (t) => {
    if (t !== 'system') return t;
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Apply theme class to <html> and update body meta
  const applyTheme = (t) => {
    const resolved = getResolvedTheme(t);
    if (typeof document === 'undefined') return;
    
    const html = document.documentElement;
    if (resolved === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  };

  // Handle theme change (user manually selected)
  const setTheme = (newTheme) => {
    if (!VALID_THEMES.includes(newTheme)) return;
    
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  };

  // Setup system preference listener (web, not iOS PWA)
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      applyTheme(theme);
      setIsSystemPreference(true);
    };

    // addEventListener (modern API)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    
    // addListener fallback (legacy Safari)
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [theme]);

  // Setup polling fallback for iOS PWA (limited system preference reactivity)
  // Check every 10 seconds if system preference changed
  useEffect(() => {
    if (theme !== 'system') {
      // Clear polling if user manually selected light/dark
      if (pollingId) {
        clearInterval(pollingId);
        setPollingId(null);
      }
      return;
    }

    // If already polling, don't start another
    if (pollingId) return;

    const id = setInterval(() => {
      const currentResolved = getResolvedTheme(theme);
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      
      if (currentResolved !== systemPreference) {
        applyTheme(theme); // Re-resolve and apply
        setIsSystemPreference(true);
      }
    }, 10000); // 10 second poll

    setPollingId(id);
    return () => clearInterval(id);
  }, [theme, pollingId]);

  // Initial apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, []);

  return {
    theme,
    setTheme,
    isSystemPreference,
    resolvedTheme: getResolvedTheme(theme),
  };
}