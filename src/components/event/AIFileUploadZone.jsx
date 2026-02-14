import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/utils/i18n";

/**
 * AIFileUploadZone — Lets user upload a PDF or image for AI ingestion.
 * Uploads the file via Core.UploadFile, then calls back with the file_url.
 * The parent (EventAIHelper) passes that URL to InvokeLLM via file_urls.
 */
export default function AIFileUploadZone({ onFileUploaded, disabled }) {
  const { language } = useLanguage();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null); // { name, url }

  const handleFile = async (file) => {
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(language === 'es'
        ? 'Solo se permiten archivos PDF o imágenes (PNG, JPG)'
        : 'Only PDF or image files (PNG, JPG) are allowed');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error(language === 'es' ? 'Archivo muy grande (máx 20MB)' : 'File too large (max 20MB)');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedFile({ name: file.name, url: file_url });
      onFileUploaded(file_url);
      toast.success(language === 'es' ? 'Archivo subido' : 'File uploaded');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(language === 'es' ? 'Error al subir archivo' : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearFile = () => {
    setUploadedFile(null);
    onFileUploaded(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (uploadedFile) {
    const isPdf = uploadedFile.name?.toLowerCase().endsWith('.pdf');
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
        {isPdf ? <FileText className="w-4 h-4 text-green-600 shrink-0" /> : <Image className="w-4 h-4 text-green-600 shrink-0" />}
        <span className="text-green-800 truncate flex-1 font-medium">{uploadedFile.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-green-600 hover:text-red-600"
          onClick={clearFile}
          disabled={disabled}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={disabled || uploading}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2 text-blue-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">{language === 'es' ? 'Subiendo...' : 'Uploading...'}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Upload className="w-6 h-6" />
          <span className="text-sm">
            {language === 'es'
              ? 'Arrastra un PDF o imagen, o haz clic para seleccionar'
              : 'Drag a PDF or image, or click to select'}
          </span>
          <span className="text-xs text-gray-400">PDF, PNG, JPG — max 20MB</span>
        </div>
      )}
    </div>
  );
}