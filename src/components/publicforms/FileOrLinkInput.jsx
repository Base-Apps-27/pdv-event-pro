/**
 * FileOrLinkInput.jsx
 * 
 * Hybrid input: Upload a file (Base44 CDN, ≤50MB) OR paste a link.
 * Stores a single URL string — upload produces a CDN URL, paste is used as-is.
 * 
 * Decision: "File Upload Strategy — Base44 Upload + Link Fallback" (2026-02-28)
 * - Base44 upload for files ≤50MB in supported formats
 * - Link paste for everything else (large video, PPT, Google Slides, etc.)
 * - Single URL field on entity — no schema changes needed
 * 
 * Props:
 *   value        - current URL string
 *   onChange      - (url: string) => void
 *   accept       - file input accept string (e.g. "image/*,.pdf,.mp4")
 *   label        - field label (bilingual)
 *   placeholder  - input placeholder
 *   helpText     - optional guidance text shown below
 *   maxSizeMB    - max file size in MB (default 50)
 *   variant      - 'default' | 'compact' for admin vs public form contexts
 */
import React, { useState, useRef, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Link2, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { PublicFormLangContext } from './PublicFormLangContext';

// Supported upload formats on Base44 (from platform docs)
const SUPPORTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.pdf', '.csv', '.xlsx', '.xls', '.json',
  '.mp4', '.mp3', '.wav', '.webm', '.ogg'
];

function getFileExtension(name) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.substring(idx).toLowerCase() : '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileOrLinkInput({
  value,
  onChange,
  accept,
  label,
  placeholder = 'https://drive.google.com/...',
  helpText,
  maxSizeMB = 50,
  variant = 'default',
}) {
  const [mode, setMode] = useState('link'); // 'link' | 'upload'
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef(null);

  // Direct context consumption — safe outside the Provider (falls back to ES default).
  // When rendered on admin pages without PublicFormLangProvider, default context value is used.
  const langCtx = useContext(PublicFormLangContext);
  const tFn = langCtx.t;

  const isCompact = variant === 'compact';
  const inputClass = isCompact
    ? 'w-full p-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10'
    : 'w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10';

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(
        tFn(`Archivo muy grande (${formatFileSize(file.size)}). Máximo: ${maxSizeMB}MB. Suba a Google Drive y pegue el enlace.`, `File too large (${formatFileSize(file.size)}). Max: ${maxSizeMB}MB. Upload to Google Drive and paste the link.`)
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file type
    const ext = getFileExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setUploadError(
        tFn(`Formato no soportado (${ext}). Suba a Google Drive y pegue el enlace.`, `Unsupported format (${ext}). Upload to Google Drive and paste the link.`)
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Upload via Base44
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    setUploadedFileName(file.name);
    onChange(file_url);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClear = () => {
    onChange('');
    setUploadedFileName('');
    setUploadError('');
  };

  const hasValue = value && value.trim();

  return (
    <div className="space-y-2">
      {/* Label */}
      {label && (
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      )}

      {/* Mode toggle tabs */}
      <div className="flex gap-1 mb-1">
        <button
          type="button"
          onClick={() => { setMode('upload'); setUploadError(''); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-[#1F8A70]/10 text-[#1F8A70] border border-[#1F8A70]/30'
              : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          {tFn('Subir', 'Upload')}
        </button>
        <button
          type="button"
          onClick={() => { setMode('link'); setUploadError(''); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mode === 'link'
              ? 'bg-[#1F8A70]/10 text-[#1F8A70] border border-[#1F8A70]/30'
              : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          {tFn('Enlace', 'Link')}
        </button>
      </div>

      {/* Upload mode */}
      {mode === 'upload' && (
        <div>
          {!hasValue ? (
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                uploading
                  ? 'border-gray-300 bg-gray-50 cursor-wait'
                  : 'border-gray-300 hover:border-[#1F8A70] hover:bg-[#1F8A70]/5'
              }`}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">{tFn('Subiendo...', 'Uploading...')}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-sm text-gray-600 font-medium">
                    {tFn('Suba su archivo final aquí', 'Upload your final file here')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {tFn(`Máx ${maxSizeMB}MB · PDF, imágenes, MP4, MP3`, `Max ${maxSizeMB}MB · PDF, images, MP4, MP3`)}
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={accept || SUPPORTED_EXTENSIONS.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-green-800 truncate">
                  {uploadedFileName || tFn('Archivo subido', 'File uploaded')}
                </p>
                <a href={value} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 hover:underline truncate block">
                  {value}
                </a>
              </div>
              <button type="button" onClick={handleClear} className="p-1 text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Link mode */}
      {mode === 'link' && (
        <div className="relative">
          <input
            type="url"
            value={value || ''}
            onChange={e => {
              onChange(e.target.value);
              setUploadedFileName('');
            }}
            placeholder={placeholder}
            className={inputClass}
          />
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{uploadError}</p>
        </div>
      )}

      {/* Help text */}
      {helpText && !uploadError && (
        <p className="text-xs text-gray-400">{helpText}</p>
      )}

      {/* Standing guidance: ready-to-install only */}
      {!hasValue && !uploadError && !helpText && (
        <p className="text-[10px] text-gray-400 italic leading-snug">
          {tFn(
            'Por favor suba únicamente material final listo para proyección. Si necesita crear o ajustar algún contenido, le pedimos coordinar primero con la oficina para asegurar que todo esté preparado correctamente.',
            'Please upload only final material ready for projection. If you need to create or adjust any content, please coordinate with the office first to ensure everything is properly prepared.'
          )}
        </p>
      )}
    </div>
  );
}