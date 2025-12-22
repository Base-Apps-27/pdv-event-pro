import { useEffect } from 'react';

export function DisableDarkMode() {
  useEffect(() => {
    // Force remove dark mode class
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    
    // Override localStorage dark mode settings
    if (localStorage.theme === 'dark' || localStorage.theme === 'system') {
      localStorage.removeItem('theme');
    }
    
    // Set explicit light mode
    document.documentElement.setAttribute('data-theme', 'light');
    
    // Watch for changes and revert them
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
          }
          if (document.body.classList.contains('dark')) {
            document.body.classList.remove('dark');
          }
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    observer.observe(document.body, { attributes: true });
    
    return () => observer.disconnect();
  }, []);
  
  return null;
}