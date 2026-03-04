/**
 * FileOrLinkInput.jsx
 * 
 * Hybrid input: Upload a file (Base44 CDN, ≤50MB) OR paste a link.
 * Stores a single URL string. Upload produces a CDN URL, paste is used as-is.
 * 
 * Decision: "File Upload Strategy: Base44 Upload + Link Fallback" (2026-02-28)
 * 
 * Features:
 *   - Drag-and-drop support with visual feedback
 *   - Simulated progress indicator during upload
 *   - Clear, specific error messages (size, type, network)
 *   - Confirmation step before deleting an uploaded file
 *   - Bilingual (ES/EN) via PublicFormLangContext
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
import React, { useState, useRef, useContext, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Link2, CheckCircle2, Loader2, AlertCircle, Trash2, Pencil, Image, FileText, Film, Music, File, ExternalLink } from 'lucide-react';
import { PublicFormLangContext } from './PublicFormLangContext';

// Supported upload formats on Base44 (from platform docs)
const SUPPORTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.pdf', '.csv', '.xlsx', '.xls', '.json',
  '.mp4', '.mp3', '.wav', '.webm', '.ogg',
  '.pptx', '.doc', '.docx', '.mov'
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

/**
 * Detect file category from URL/filename for visual differentiation.
 * Categories: image, pdf, video, audio, link, other
 */
function getFileCategory(url) {
  if (!url) return 'other';
  const lower = url.toLowerCase().split('?')[0];
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) return 'image';
  if (/\.pdf$/.test(lower)) return 'pdf';
  if (/\.(mp4|mov|webm)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg)$/.test(lower)) return 'audio';
  if (/\.(pptx|doc|docx|xlsx|xls|csv)$/.test(lower)) return 'document';
  return 'other';
}

/** Visual config per file category — icon, colors, label */
const FILE_CATEGORY_STYLES = {
  image:    { Icon: Image,    bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-500', labelEs: 'Imagen', labelEn: 'Image' },
  pdf:      { Icon: FileText, bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',    icon: 'text-red-500',    labelEs: 'PDF',    labelEn: 'PDF' },
  video:    { Icon: Film,     bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',   icon: 'text-blue-500',   labelEs: 'Video',  labelEn: 'Video' },
  audio:    { Icon: Music,    bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',  icon: 'text-amber-500',  labelEs: 'Audio',  labelEn: 'Audio' },
  document: { Icon: File,     bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-700',  icon: 'text-green-500',  labelEs: 'Documento', labelEn: 'Document' },
  other:    { Icon: File,     bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-700',  icon: 'text-green-500',  labelEs: 'Archivo', labelEn: 'File' },
  link:     { Icon: ExternalLink, bg: 'bg-sky-50', border: 'border-sky-200',    text: 'text-sky-700',    icon: 'text-sky-500',    labelEs: 'Enlace', labelEn: 'Link' },
};

function extractFilename(url) {
  if (!url) return '';
  try {
    const urlWithoutQuery = url.split('?')[0];
    const parts = urlWithoutQuery.split('/');
    const lastPart = parts[parts.length - 1];
    if (!lastPart) return url;
    
    let decoded = decodeURIComponent(lastPart);
    
    // Strip common storage prefixes (e.g. 9-char hex + underscore, or 36-char uuid + underscore)
    const prefixMatch = decoded.match(/^[a-fA-F0-9-]{8,36}_(.*)/);
    if (prefixMatch && prefixMatch[1]) {
      return prefixMatch[1];
    }
    
    return decoded;
  } catch {
    return url;
  }
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
  const [mode, setMode] = useState('upload'); // 'link' | 'upload'  — default to upload (primary action)
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100 simulated progress
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isLinkLocked, setIsLinkLocked] = useState(!!value && !value.includes('/storage/v1/object/public/') && !value.includes('base44'));
  const fileInputRef = useRef(null);
  const progressTimerRef = useRef(null);

  // Direct context consumption. Safe outside the Provider (falls back to ES default).
  const langCtx = useContext(PublicFormLangContext);
  const tFn = langCtx.t;

  const isCompact = variant === 'compact';
  const inputClass = isCompact
    ? 'w-full p-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10'
    : 'w-full p-2.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:border-[#1F8A70] focus:ring-2 focus:ring-[#1F8A70]/10';

  /** Simulated progress bar: ramps from 0 to ~90 while upload is in flight, then jumps to 100 on completion */
  const startProgress = useCallback(() => {
    setUploadProgress(0);
    let current = 0;
    progressTimerRef.current = setInterval(() => {
      // Quick initial ramp, slows as it approaches 90
      current += Math.max(1, (90 - current) * 0.15);
      if (current >= 90) current = 90;
      setUploadProgress(Math.round(current));
    }, 200);
  }, []);

  const stopProgress = useCallback((success) => {
    clearInterval(progressTimerRef.current);
    if (success) {
      setUploadProgress(100);
      // Reset after a brief flash at 100%
      setTimeout(() => setUploadProgress(0), 600);
    } else {
      setUploadProgress(0);
    }
  }, []);

  /** Validate and upload a file */
  const processFile = useCallback(async (file) => {
    if (!file) return;
    setUploadError('');
    setConfirmingDelete(false);

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(
        tFn(
          `El archivo es muy grande (${formatFileSize(file.size)}). El máximo permitido es ${maxSizeMB}MB. Puede subirlo a Google Drive y pegar el enlace.`,
          `File is too large (${formatFileSize(file.size)}). Maximum allowed is ${maxSizeMB}MB. You can upload it to Google Drive and paste the link.`
        )
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file type
    const ext = getFileExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setUploadError(
        tFn(
          `El formato "${ext}" no es compatible para subida directa. Formatos aceptados: PDF, imágenes, MP4, MP3, PPTX, Word. Puede subir a Google Drive y pegar el enlace.`,
          `The "${ext}" format is not supported for direct upload. Accepted formats: PDF, images, MP4, MP3, PPTX, Word. You can upload to Google Drive and paste the link.`
        )
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Upload via Base44
    setUploading(true);
    startProgress();
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    stopProgress(true);
    setUploading(false);
    setUploadedFileName(file.name);
    onChange(file_url);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [maxSizeMB, tFn, onChange, startProgress, stopProgress]);

  const handleFileSelect = (e) => {
    processFile(e.target.files?.[0]);
  };

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragOver(true);
  }, [uploading]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }, [uploading, processFile]);

  /** Delete with confirmation */
  const handleDeleteClick = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    // Confirmed: clear
    onChange('');
    setUploadedFileName('');
    setUploadError('');
    setConfirmingDelete(false);
  };

  const cancelDelete = () => setConfirmingDelete(false);

  const handleClearLink = () => {
    onChange('');
    setUploadedFileName('');
    setUploadError('');
  };

  const handleLinkBlur = (e) => {
    // Only lock if there is an actual value
    if (e.target.value.trim() !== '') {
      setIsLinkLocked(true);
    }
  };

  const hasValue = value && value.trim();
  const isUploaded = hasValue && (value.includes('/storage/v1/object/public/') || value.includes('base44'));
  const displayMode = hasValue ? (isUploaded ? 'upload' : 'link') : mode;

  return (
    <div className="space-y-2">
      {/* Label */}
      {label && (
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      )}

      {/* Mode toggle tabs */}
      {!hasValue && (
        <div className="flex gap-1 mb-1">
          <button
          type="button"
          onClick={() => { setMode('upload'); setUploadError(''); setConfirmingDelete(false); }}
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
          onClick={() => { setMode('link'); setUploadError(''); setConfirmingDelete(false); }}
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
      )}

      {/* Upload mode */}
      {displayMode === 'upload' && (
        <div>
          {!hasValue ? (
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                uploading
                  ? 'border-gray-300 bg-gray-50 cursor-wait'
                  : isDragOver
                    ? 'border-[#1F8A70] bg-[#1F8A70]/10 scale-[1.01]'
                    : 'border-gray-300 hover:border-[#1F8A70] hover:bg-[#1F8A70]/5'
              }`}
            >
              {uploading ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">{tFn('Subiendo...', 'Uploading...')}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${uploadProgress}%`,
                        background: 'linear-gradient(90deg, #1F8A70 0%, #8DC63F 100%)'
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">{uploadProgress}%</p>
                </div>
              ) : (
                <>
                  <Upload className={`w-6 h-6 mx-auto mb-1 ${isDragOver ? 'text-[#1F8A70]' : 'text-gray-400'}`} />
                  <p className="text-sm text-gray-600 font-medium">
                    {isDragOver
                      ? tFn('Suelte el archivo aquí', 'Drop file here')
                      : tFn('Arrastre o haga clic para subir', 'Drag or click to upload')
                    }
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {tFn(`Máx ${maxSizeMB}MB`, `Max ${maxSizeMB}MB`)}
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
            (() => {
              const cat = getFileCategory(value);
              const style = FILE_CATEGORY_STYLES[cat];
              const CatIcon = style.Icon;
              return (
                <div className={`flex items-center gap-2 p-2.5 ${style.bg} border ${style.border} rounded-md`}>
                  <CatIcon className={`w-4 h-4 ${style.icon} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <a 
                      href={value} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={`text-xs font-medium ${style.text} hover:underline truncate block`}
                      title={uploadedFileName || extractFilename(value) || tFn('Archivo subido', 'File uploaded')}
                    >
                      {uploadedFileName || extractFilename(value) || tFn('Archivo subido', 'File uploaded')}
                    </a>
                    <span className={`text-[10px] ${style.icon} truncate block`}>
                      {tFn(style.labelEs, style.labelEn)}
                    </span>
                  </div>
                  {/* Delete with confirmation */}
                  {confirmingDelete ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={handleDeleteClick} className="px-2 py-1 text-[10px] font-bold text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors">
                        {tFn('Sí, eliminar', 'Yes, remove')}
                      </button>
                      <button type="button" onClick={cancelDelete} className="px-2 py-1 text-[10px] font-bold text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
                        {tFn('No', 'No')}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={handleDeleteClick} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title={tFn('Eliminar archivo', 'Remove file')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Link mode — visually distinct from file uploads (sky/blue theme + pencil edit) */}
      {displayMode === 'link' && (
        <div>
          {hasValue && isLinkLocked ? (
            <div className="flex items-center gap-2 p-2.5 bg-sky-50 border border-sky-200 rounded-md">
              <ExternalLink className="w-4 h-4 text-sky-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <a 
                  href={value} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline truncate block" 
                  title={value}
                >
                  {value}
                </a>
                <span className="text-[10px] text-sky-500 truncate block">
                  {tFn('Enlace adjunto', 'Link attached')}
                </span>
              </div>
              {/* Pencil to unlock edit, Trash to delete */}
              <button
                type="button"
                onClick={() => setIsLinkLocked(false)}
                className="p-1 shrink-0 text-gray-400 hover:text-sky-600 transition-colors"
                title={tFn('Editar enlace', 'Edit link')}
              >
                <Pencil className="w-4 h-4" />
              </button>
              {confirmingDelete ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={handleDeleteClick} className="px-2 py-1 text-[10px] font-bold text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors">
                    {tFn('Sí', 'Yes')}
                  </button>
                  <button type="button" onClick={cancelDelete} className="px-2 py-1 text-[10px] font-bold text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
                    {tFn('No', 'No')}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={handleDeleteClick} className="p-1 shrink-0 text-gray-400 hover:text-red-500 transition-colors" title={tFn('Eliminar enlace', 'Remove link')}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={value || ''}
                onChange={e => {
                  onChange(e.target.value);
                  setUploadedFileName('');
                }}
                onBlur={handleLinkBlur}
                placeholder={placeholder}
                className={`flex-1 min-w-0 ${inputClass}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{uploadError}</p>
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
            'Por favor suba únicamente material final listo para proyección. Si necesita crear o ajustar algún contenido, le pedimos coordinar primero con la oficina.',
            'Please upload only final material ready for projection. If you need to create or adjust any content, please coordinate with the office first.'
          )}
        </p>
      )}
    </div>
  );
}