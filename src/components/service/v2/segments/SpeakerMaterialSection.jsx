/**
 * SpeakerMaterialSection.jsx — V2 speaker material inputs.
 * HARDENING (Phase 9):
 *   - Memoized
 *   - Print: shows URLs as clickable links
 *   - URL validation visual hint (green border for valid URLs)
 */

import React, { useState, useEffect, memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, FileText, Video, Image as ImageIcon, ExternalLink, Plus, Trash2, Headphones } from "lucide-react";
import { SPEAKER_MATERIAL_FIELDS } from "../constants/fieldMap";
import { useLanguage } from "@/components/utils/i18n.jsx";

function isValidUrl(str) {
  if (!str) return false;
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('www.');
}

export default memo(function SpeakerMaterialSection({ segment, onWrite }) {
  const { t } = useLanguage();
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3 mt-2 space-y-2">
      <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
        <Link className="w-3 h-3" />
        {t('speaker.materialTitle')}
      </Label>

      {/* Screen: editable */}
      <div className="print:hidden space-y-2">
        {SPEAKER_MATERIAL_FIELDS.map(f => {
          const fLabel = t(f.labelKey);
          if (f.type === 'checkbox') {
            return (
              <div key={f.column} className="flex items-center space-x-2">
                <Checkbox
                  checked={!!segment[f.column]}
                  onCheckedChange={(checked) => onWrite(segment.id, f.column, checked)}
                  id={`${f.column}-${segment.id}`}
                  className="bg-white"
                />
                <label
                  htmlFor={`${f.column}-${segment.id}`}
                  className="text-xs cursor-pointer text-gray-600"
                >
                  {fLabel}
                </label>
              </div>
            );
          }
          return (
            <SpeakerResourceList
              key={f.column}
              segment={segment}
              column={f.column}
              placeholder={fLabel}
              onWrite={onWrite}
            />
          );
        })}
      </div>

      {/* Print: read-only with links */}
      <div className="hidden print:block space-y-1">
        {SPEAKER_MATERIAL_FIELDS.map(f => {
          const val = segment[f.column];
          const pLabel = t(f.labelKey);
          if (!val) return null;
          if (f.type === 'checkbox') {
            return val ? (
              <div key={f.column} className="text-xs text-gray-700">✓ {pLabel}</div>
            ) : null;
          }
          return (
            <div key={f.column} className="text-xs">
              <span className="font-semibold">{pLabel}:</span>{' '}
              {(Array.isArray(val) ? val : val.split(',')).map((u, i) => {
                const url = u.trim();
                if (!url) return null;
                return (
                  <span key={i} className="inline-block mr-2">
                    {isValidUrl(url) ? (
                      <a href={url.startsWith('http') ? url : `https://${url}`} className="text-blue-600 underline">{url}</a>
                    ) : (
                      <span className="text-gray-700">{url}</span>
                    )}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function getResourceType(url) {
  if (!url) return 'link';
  const lurl = url.toLowerCase();
  if (lurl.includes('.pdf')) return 'pdf';
  if (lurl.includes('.mp4') || lurl.includes('.mov') || lurl.includes('youtube.com') || lurl.includes('youtu.be') || lurl.includes('vimeo.com')) return 'video';
  if (lurl.includes('.png') || lurl.includes('.jpg') || lurl.includes('.jpeg') || lurl.includes('.webp') || lurl.includes('.gif')) return 'image';
  if (lurl.includes('.mp3') || lurl.includes('.wav')) return 'audio';
  return 'link';
}

function getResourceLabel(type, typeIndex, es) {
  const labelsEs = { pdf: 'PDF', video: 'Video', image: 'Imagen', audio: 'Audio', link: 'Enlace' };
  const labelsEn = { pdf: 'PDF', video: 'Video', image: 'Image', audio: 'Audio', link: 'Link' };
  return `${es ? labelsEs[type] : labelsEn[type]} ${typeIndex + 1}`;
}

const ResourceCard = ({ url, index, typeIndex, onDelete, lang }) => {
  const type = getResourceType(url);
  const es = lang === 'es';
  const label = getResourceLabel(type, typeIndex, es);

  const icons = {
    pdf: <FileText className="w-4 h-4 text-red-500 shrink-0" />,
    video: <Video className="w-4 h-4 text-blue-500 shrink-0" />,
    image: <ImageIcon className="w-4 h-4 text-green-500 shrink-0" />,
    audio: <Headphones className="w-4 h-4 text-purple-500 shrink-0" />,
    link: <ExternalLink className="w-4 h-4 text-gray-500 shrink-0" />,
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-[#1F8A70] transition-colors group">
      {icons[type]}
      <div className="flex-1 min-w-0">
        <a href={isValidUrl(url) ? (url.startsWith('http') ? url : `https://${url}`) : '#'} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-gray-700 hover:text-[#1F8A70] truncate block">
          {label}
        </a>
        <a href={isValidUrl(url) ? (url.startsWith('http') ? url : `https://${url}`) : '#'} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:underline truncate block">
          {url.replace(/^https?:\/\//, '')}
        </a>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

const SpeakerResourceList = memo(function SpeakerResourceList({ segment, column, placeholder, onWrite }) {
  const { language, t } = useLanguage();
  const value = segment[column] || [];
  const urls = Array.isArray(value) ? value : value.split(',').map(s => s.trim()).filter(Boolean);
  const [isEditing, setIsEditing] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  const handleDelete = (idx) => {
    const next = [...urls];
    next.splice(idx, 1);
    onWrite(segment.id, column, next);
  };

  const handleAdd = () => {
    if (newUrl.trim()) {
      const next = [...urls, newUrl.trim()];
      onWrite(segment.id, column, next);
      setNewUrl('');
      setIsEditing(false);
    }
  };

  // Pre-calculate type indices for labels (e.g. PDF 1, PDF 2, Video 1)
  const typeCounts = {};
  const urlWithMeta = urls.map((url, idx) => {
    const type = getResourceType(url);
    if (typeCounts[type] === undefined) typeCounts[type] = 0;
    const typeIndex = typeCounts[type]++;
    return { url, idx, type, typeIndex };
  });

  return (
    <div className="space-y-2 mt-3">
      <Label className="text-xs font-medium text-gray-600 block mb-1">{placeholder}</Label>
      
      {urls.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {urlWithMeta.map((item) => (
            <ResourceCard 
              key={item.idx} 
              url={item.url} 
              index={item.idx} 
              typeIndex={item.typeIndex}
              onDelete={handleDelete} 
              lang={language} 
            />
          ))}
        </div>
      )}
      
      {isEditing ? (
        <div className="flex items-center gap-2 mt-2">
          <Input 
            value={newUrl} 
            onChange={e => setNewUrl(e.target.value)} 
            placeholder={t('speaker.pasteUrl', 'Paste URL here...')}
            className="text-xs h-8 flex-1"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button type="button" onClick={handleAdd} className="px-3 py-1.5 bg-[#1F8A70] text-white text-xs font-semibold rounded-md hover:bg-[#166b56] shrink-0">
            {t('common.add', 'Add')}
          </button>
          <button type="button" onClick={() => { setIsEditing(false); setNewUrl(''); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-md hover:bg-gray-200 shrink-0">
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      ) : (
        <button 
          type="button" 
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#1F8A70] hover:text-[#166b56] mt-1 p-1 rounded hover:bg-[#1F8A70]/5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('speaker.addResource', 'Add resource')}
        </button>
      )}
    </div>
  );
});