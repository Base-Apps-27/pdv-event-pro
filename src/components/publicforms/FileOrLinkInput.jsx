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
 *   maxSizeMB    - max file size in MB (default 50) — files larger than this route to Google Drive
 *   driveMaxSizeMB - hard ceiling for Drive uploads (default 500)
 *   variant      - 'default' | 'compact' for admin vs public form contexts
 *   eventName    - (optional) event name for Drive folder organization
 *   eventYear    - (optional) event year for Drive folder organization
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
  driveMaxSizeMB = 500,
  variant = 'default',
  eventName = '',
  eventYear = '',
}) {
  const [mode, setMode] = useState('upload'); // 'link' | 'upload'  — default to upload (primary action)
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100 simulated progress
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const initialValue = typeof value === 'string' ? value : (Array.isArray(value) ? (value[0] || '') : '');
  const [isLinkLocked, setIsLinkLocked] = useState(!!initialValue && !initialValue.includes('/storage/v1/object/public/') && !initialValue.includes('base44'));
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

  /**
   * Convert a File to base64 string for Drive upload.
   * Google Drive overflow (2026-03-06): files >50MB bypass Base44 and go to Drive.
   */
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Strip the data:...;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  /** Validate and upload a file — routes to Drive if >maxSizeMB */
  const processFile = useCallback(async (file) => {
    if (!file) return;
    setUploadError('');
    setConfirmingDelete(false);

    const fileSizeBytes = file.size;
    const maxBytes = maxSizeMB * 1024 * 1024;
    const driveMaxBytes = driveMaxSizeMB * 1024 * 1024;
    const useDriveOverflow = fileSizeBytes > maxBytes;

    // Hard ceiling — even Drive has limits
    if (fileSizeBytes > driveMaxBytes) {
      setUploadError(
        tFn(
          `El archivo es muy grande (${formatFileSize(fileSizeBytes)}). El máximo permitido es ${driveMaxSizeMB}MB.`,
          `File is too large (${formatFileSize(fileSizeBytes)}). Maximum allowed is ${driveMaxSizeMB}MB.`
        )
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file type (only for Base44 direct upload — Drive accepts anything)
    if (!useDriveOverflow) {
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
    }

    setUploading(true);
    startProgress();

    if (useDriveOverflow) {
      // Google Drive overflow path (2026-03-06 Decision)
      // Convert file to base64 and send to backend function
      const fileBase64 = await fileToBase64(file);
      const response = await base44.functions.invoke('uploadToDrive', {
        fileBase64,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        eventName: eventName || '',
        year: eventYear || String(new Date().getFullYear()),
      });
      stopProgress(true);
      setUploading(false);
      setUploadedFileName(file.name);
      onChange(response.data.url);
    } else {
      // Standard Base44 upload path (≤50MB)
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      stopProgress(true);
      setUploading(false);
      setUploadedFileName(file.name);
      onChange(file_url);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [maxSizeMB, driveMaxSizeMB, tFn, onChange, startProgress, stopProgress, eventName, eventYear]);

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

  // Guard: value might arrive as array (e.g. presentation_url schema is string[]).
  // Normalise to string so .trim()/.includes() never crash.
  const safeValue = typeof value === 'string' ? value : (Array.isArray(value) ? (value[0] || '') : '');
  const hasValue = safeValue && safeValue.trim();
  // Treat Base44 CDN URLs and Google Drive links (from overflow uploads) as "uploaded" files
  const isUploaded = hasValue && (
    safeValue.includes('/storage/v1/object/public/') ||
    safeValue.includes('base44') ||
    safeValue.includes('drive.google.com/file/')
  );
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
                    {tFn(
                      `Máx ${driveMaxSizeMB}MB · Archivos mayores de ${maxSizeMB}MB se suben a Google Drive`,
                      `Max ${driveMaxSizeMB}MB · Files over ${maxSizeMB}MB upload to Google Drive`
                    )}
                  </p>
                </>
              )}
              {/* No accept filter — Drive overflow accepts any format.
                   Base44-only formats are validated in processFile for ≤50MB files. */}
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            (() => {
              const cat = getFileCategory(safeValue);
              const style = FILE_CATEGORY_STYLES[cat];
              const CatIcon = style.Icon;
              return (
                <div className={`flex items-center gap-2 p-2.5 ${style.bg} border ${style.border} rounded-md`}>
                  <CatIcon className={`w-4 h-4 ${style.icon} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <a 
                      href={safeValue} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={`text-xs font-medium ${style.text} hover:underline truncate block`}
                      title={uploadedFileName || extractFilename(safeValue) || tFn('Archivo subido', 'File uploaded')}
                    >
                      {uploadedFileName || extractFilename(safeValue) || tFn('Archivo subido', 'File uploaded')}
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
                  href={safeValue} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline truncate block" 
                  title={safeValue}
                >
                  {safeValue}
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
                value={safeValue || ''}
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