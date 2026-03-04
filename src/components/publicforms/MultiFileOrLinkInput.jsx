import React, { useContext } from 'react';
import FileOrLinkInput from './FileOrLinkInput';
import { PublicFormLangContext } from './PublicFormLangContext';

export default function MultiFileOrLinkInput({
  urls = [], // array of strings
  onChange,  // (urls: string[]) => void
  maxCount = 4,
  accept,
  label,
  placeholder,
  helpText,
  maxSizeMB = 50,
  variant = 'default',
}) {
  const langCtx = useContext(PublicFormLangContext);
  const tFn = langCtx?.t || ((es, en) => es);

  // Guard: urls might be a string, array, or unexpected type. Normalise to string[].
  const currentUrls = Array.isArray(urls)
    ? urls.map(u => (typeof u === 'string' ? u : String(u || ''))).filter(Boolean)
    : (typeof urls === 'string' && urls ? urls.split(',').map(u => u.trim()).filter(Boolean) : []);

  const updateUrl = (index, newUrl) => {
    const next = [...currentUrls];
    next[index] = newUrl;
    onChange(next.filter(Boolean));
  };

  const addUrl = (newUrl) => {
    if (newUrl) {
      onChange([...currentUrls, newUrl].filter(Boolean));
    }
  };

  const canAdd = currentUrls.length < maxCount;

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide flex justify-between items-center mb-2">
          <span>{label}</span>
          <span className="text-[10px] text-gray-400 font-normal normal-case">
             {currentUrls.length} / {maxCount}
          </span>
        </label>
      )}
      
      <div className="space-y-3">
        {currentUrls.map((url, idx) => (
          <div key={idx} className="relative group">
            <FileOrLinkInput
              value={url}
              onChange={(newUrl) => updateUrl(idx, newUrl)}
              accept={accept}
              placeholder={placeholder}
              maxSizeMB={maxSizeMB}
              variant={variant}
            />
          </div>
        ))}

        {canAdd && (
          <div className="pt-1">
             <FileOrLinkInput
                value={''}
                onChange={addUrl}
                accept={accept}
                placeholder={tFn('Añadir otro archivo o enlace...', 'Add another file or link...')}
                maxSizeMB={maxSizeMB}
                variant={variant}
             />
          </div>
        )}
      </div>

      {helpText && (
        <p className="text-xs text-gray-400">{helpText}</p>
      )}
    </div>
  );
}