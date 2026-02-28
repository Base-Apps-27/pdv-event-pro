/**
 * AutoGrowTextarea.jsx
 * 
 * Auto-growing textarea that expands to fit its content.
 * Eliminates the tiny-scrollbox UX problem where admins paste long
 * run-of-show instructions or scripture passages into rows=2 boxes.
 * 
 * 2026-02-28: Created for Arts public form. Reusable across all public forms.
 * Uses the standard scrollHeight trick — no external dependencies.
 * minRows sets the minimum visible height; textarea grows from there.
 */
import React, { useRef, useEffect, useCallback } from 'react';

const BASE_CLASS = 'w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] overflow-hidden';

export default function AutoGrowTextarea({ value, onChange, placeholder, className, minRows = 2, ...rest }) {
  const ref = useRef(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Reset to minRows height first so shrinking works when text is deleted
    el.style.height = 'auto';
    // Grow to scrollHeight (content height)
    el.style.height = el.scrollHeight + 'px';
  }, []);

  // Resize on value change (handles external state updates / initial load)
  useEffect(() => { resize(); }, [value, resize]);

  // Also resize after mount (fonts may load async)
  useEffect(() => {
    const timer = setTimeout(resize, 100);
    return () => clearTimeout(timer);
  }, [resize]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={e => {
        onChange(e);
        // Immediate resize on user input for fluid feel
        resize();
      }}
      placeholder={placeholder}
      className={className || BASE_CLASS}
      style={{ resize: 'none' }}
      {...rest}
    />
  );
}