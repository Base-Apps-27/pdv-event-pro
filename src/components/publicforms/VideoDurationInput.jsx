/**
 * VideoDurationInput.jsx
 * 
 * Smart duration input that accepts MM:SS format or plain seconds.
 * Shows a friendly MM:SS display alongside the raw seconds value.
 * Prevents confusion where users enter "3:30" meaning 3min 30sec but
 * the field expected raw seconds.
 * 
 * 2026-02-28: Created to fix admin confusion entering timestamps instead of seconds.
 * Used by both public ArtsTypeVideo and admin VideoSection.
 */
import React, { useState, useEffect } from 'react';

/**
 * Parse a user input string into total seconds.
 * Accepts: "90", "1:30", "01:30", "3:30", "0:45"
 * Returns NaN if unparseable.
 */
function parseToSeconds(raw) {
  if (!raw || raw.trim() === '') return '';
  const trimmed = raw.trim();

  // MM:SS format
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return NaN;
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (isNaN(mins) || isNaN(secs) || secs < 0 || secs > 59 || mins < 0) return NaN;
    return mins * 60 + secs;
  }

  // Plain number (seconds)
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 0) return NaN;
  return num;
}

/** Format seconds into M:SS display string */
function formatDuration(totalSec) {
  if (!totalSec && totalSec !== 0) return '';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoDurationInput({ value, onChange, className, labelEs, labelEn, t }) {
  // The text field shows whatever the user is typing (could be "1:30" or "90")
  const [displayVal, setDisplayVal] = useState(value ? String(value) : '');

  // Sync external value changes (e.g. initial load from DB)
  useEffect(() => {
    if (value !== '' && value !== null && value !== undefined) {
      setDisplayVal(String(value));
    } else {
      setDisplayVal('');
    }
  }, [value]);

  const handleChange = (raw) => {
    setDisplayVal(raw);
    const parsed = parseToSeconds(raw);
    if (parsed === '') {
      onChange('');
    } else if (!isNaN(parsed)) {
      onChange(parsed);
    }
    // If NaN (mid-typing like "1:"), don't update parent yet — wait for valid input
  };

  const handleBlur = () => {
    // On blur, normalize display to show the resolved seconds if valid
    const parsed = parseToSeconds(displayVal);
    if (parsed !== '' && !isNaN(parsed)) {
      setDisplayVal(String(parsed));
    }
  };

  // Show a helper badge with MM:SS conversion when value is a plain number > 59
  const numericVal = typeof value === 'number' ? value : parseInt(value, 10);
  const showHelper = !isNaN(numericVal) && numericVal > 0;

  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
        {t ? t(labelEs || 'Duración', labelEn || 'Duration') : (labelEn || 'Duration')}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={displayVal}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={t ? t('Ej: 90 o 1:30', 'E.g. 90 or 1:30') : 'E.g. 90 or 1:30'}
          className={className || 'w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70]'}
        />
      </div>
      {showHelper && (
        <p className="text-[10px] text-gray-400 mt-0.5">
          = {formatDuration(numericVal)} {t ? t('(min:seg)', '(min:sec)') : '(min:sec)'}
        </p>
      )}
    </div>
  );
}

/** Standalone export for admin editor usage without bilingual t() */
export { parseToSeconds, formatDuration };