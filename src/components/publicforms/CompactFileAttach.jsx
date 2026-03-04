/**
 * CompactFileAttach.jsx
 * 
 * Option A implementation (2026-02-28): Collapsed inline attach button that expands
 * to a full FileOrLinkInput on click. Reduces visual noise from repeated upload UIs
 * while keeping the upload contextually placed where the user is thinking about it.
 * 
 * States:
 *   - No value, collapsed: shows compact "📎 Attach [label]" button (one line)
 *   - No value, expanded: shows full FileOrLinkInput
 *   - Has value: shows compact confirmation with filename/link and remove option
 * 
 * Props: same as FileOrLinkInput (value, onChange, accept, label, placeholder, helpText, maxSizeMB)
 */
import React, { useState } from 'react';
import { Paperclip, CheckCircle2, ChevronDown, X } from 'lucide-react';
import MultiFileOrLinkInput from './MultiFileOrLinkInput';
import { usePublicLang } from './PublicFormLangContext';

export default function CompactFileAttach({
  value,
  onChange,
  accept,
  label,
  placeholder,
  helpText,
  maxSizeMB = 50,
}) {
  const { t } = usePublicLang();
  const [expanded, setExpanded] = useState(false);
  const hasValue = Array.isArray(value) ? value.length > 0 : value && value.trim();

  // Extract display name from URL (last path segment or domain)
  const displayNames = hasValue
    ? (Array.isArray(value) ? value : value.split(',')).map(v => typeof v === 'string' ? v.trim() : v).filter(Boolean).map(val => {
        try {
          const url = new URL(val);
          const parts = url.pathname.split('/').filter(Boolean);
          return decodeURIComponent(parts[parts.length - 1] || url.hostname);
        } catch { return val.substring(0, 40) + '…'; }
      })
    : [];

  // Has value: show compact confirmation line
  if (hasValue && !expanded) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-green-800 truncate block">{label}</span>
          <div className="space-y-1 mt-1">
            {(Array.isArray(value) ? value : value.split(',')).map((v, i) => v.trim() ? (
              <a key={i} href={v.trim()} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 hover:underline truncate block">
                {displayNames[i]}
              </a>
            ) : null)}
          </div>
        </div>
        <button type="button" onClick={() => setExpanded(true)} className="text-[10px] text-gray-500 hover:text-[#1F8A70] font-medium px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors shrink-0">
          {t('Cambiar', 'Change')}
        </button>
      </div>
    );
  }

  // No value, collapsed: show compact attach button
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 p-2.5 border border-dashed border-gray-300 rounded-md text-left hover:border-[#1F8A70] hover:bg-[#1F8A70]/5 transition-colors group"
      >
        <Paperclip className="w-4 h-4 text-gray-400 group-hover:text-[#1F8A70] shrink-0" />
        <span className="text-sm text-gray-500 group-hover:text-[#1F8A70] font-medium flex-1">
          {t('Adjuntar', 'Attach')}: {label}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#1F8A70] shrink-0" />
      </button>
    );
  }

  // Expanded: show full FileOrLinkInput with collapse button
  return (
    <div className="border border-gray-200 rounded-md p-3 bg-gray-50/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[10px] text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          {t('Cerrar', 'Close')}
        </button>
      </div>
      <MultiFileOrLinkInput
        urls={Array.isArray(value) ? value : (value ? value.split(',').map(s=>s.trim()).filter(Boolean) : [])}
        onChange={(arr) => {
          onChange(arr);
        }}
        maxCount={4}
        accept={accept}
        placeholder={placeholder}
        helpText={helpText}
        maxSizeMB={maxSizeMB}
      />
    </div>
  );
}