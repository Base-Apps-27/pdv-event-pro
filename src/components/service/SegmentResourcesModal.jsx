/**
 * SegmentResourcesModal - Modal to display resource links for a segment
 * 
 * Branch: Segment Resource Links Enhancement
 * Parent: Live Director improvements
 * 
 * Shows:
 * - Video URL with thumbnail
 * - Drama songs (1-3) with thumbnails
 * - Dance songs (1-3) with thumbnails
 * - Run of Show PDF link
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  Music, 
  FileText, 
  ExternalLink, 
  Play,
  User,
  Monitor,
  BookOpen,
  Lightbulb
} from "lucide-react";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { getSegmentData } from "@/components/utils/segmentDataUtils";
import ArtsResourcesSection from "@/components/service/ArtsResourcesSection";

/**
 * ResourceCard - Displays a single resource with thumbnail and metadata
 */
function ResourceCard({ title, subtitle, url, thumbnail, type, owner, icon, action }) {
  const { t, language } = useLanguage();
  
  if (!url && !action) return null;

  const getIcon = () => {
    if (icon) return icon;
    switch (type) {
      case 'video': return <Video className="w-4 h-4 text-blue-600" />;
      case 'song': return <Music className="w-4 h-4 text-pink-600" />;
      case 'pdf': return <FileText className="w-4 h-4 text-red-600" />;
      default: return <ExternalLink className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionLabel = () => {
    switch (type) {
      case 'video': return t('resources.play');
      case 'song': return t('resources.play');
      case 'pdf': return t('resources.viewPdf');
      case 'slides': return t('resources.open');
      case 'notes': return t('resources.open');
      case 'verses': return language === 'es' ? 'Ver' : 'View';
      default: return t('resources.open');
    }
  };

  const Wrapper = action ? 'button' : 'a';
  const wrapperProps = action 
    ? { onClick: action, className: "w-full text-left" }
    : { href: url, target: "_blank", rel: "noopener noreferrer" };

  return (
    <Wrapper
      {...wrapperProps}
      className={`block p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 active:bg-gray-50 transition-colors ${action ? 'cursor-pointer' : ''}`}
    >
      {/* Vertical stack: thumbnail on top (if present), then content */}
      {thumbnail && (
        <img 
          src={thumbnail} 
          alt={title}
          className="w-full h-28 sm:h-32 object-cover rounded mb-2 bg-gray-100"
          onError={(e) => { 
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
        />
      )}

      {/* Content row: icon + text + action */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">
            {title || url || t('resources.title')}
          </h4>
          {(subtitle || owner) && (
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {owner && <><User className="w-3 h-3 inline mr-0.5" />{owner}</>}
              {owner && subtitle && ' • '}
              {subtitle}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0 text-xs">
          {action ? <BookOpen className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {getActionLabel()}
        </Button>
      </div>
    </Wrapper>
  );
}

export default function SegmentResourcesModal({ open, onOpenChange, segment, onOpenVerses }) {
  const { t, language } = useLanguage();

  if (!segment) return null;

  // Helper to safely get segment data
  const getData = (field) => getSegmentData(segment, field);

  // Collect all resources
  const resources = [];

  // --- SPEAKER RESOURCES (Slides, Notes, Verses, Key Points) ---
  const speakerResources = [];
  
  const presData = getData('presentation_url');
  const presentationUrls = Array.isArray(presData) ? presData : (presData ? presData.split(',').map(s=>s.trim()).filter(Boolean) : []);
  
  const notesData = getData('notes_url');
  const notesUrls = Array.isArray(notesData) ? notesData : (notesData ? notesData.split(',').map(s=>s.trim()).filter(Boolean) : []);
  
  const parsedVerses = getData('parsed_verse_data');
  const hasKeyTakeaways = parsedVerses?.key_takeaways?.length > 0;
  
  presentationUrls.forEach((url, index) => {
    speakerResources.push({
      title: (language === 'es' ? 'Presentación (Slides)' : 'Presentation Slides') + (presentationUrls.length > 1 ? ` ${index + 1}` : ''),
      url: url,
      type: 'slides',
      icon: <Monitor className="w-4 h-4 text-blue-600" />
    });
  });

  notesUrls.forEach((url, index) => {
    speakerResources.push({
      title: (language === 'es' ? 'Notas del Orador' : 'Speaker Notes') + (notesUrls.length > 1 ? ` ${index + 1}` : ''),
      url: url,
      type: 'notes',
      icon: <FileText className="w-4 h-4 text-purple-600" />
    });
  });

  // Verses & Key Points Action (if handler provided)
  if (parsedVerses && onOpenVerses) {
    speakerResources.push({
      title: hasKeyTakeaways 
        ? (language === 'es' ? 'Versículos y Puntos Clave' : 'Verses & Key Points')
        : (language === 'es' ? 'Versículos Bíblicos' : 'Scripture References'),
      subtitle: hasKeyTakeaways ? (language === 'es' ? 'Ver contenido extraído' : 'View extracted content') : undefined,
      action: () => onOpenVerses({
        parsedData: parsedVerses,
        rawText: getData('scripture_references') || getData('verse')
      }),
      type: 'verses',
      icon: hasKeyTakeaways ? <Lightbulb className="w-4 h-4 text-amber-600" /> : <BookOpen className="w-4 h-4 text-green-600" />
    });
  }

  if (speakerResources.length > 0) {
    resources.push({
      category: language === 'es' ? 'Recursos del Orador' : 'Speaker Resources',
      items: speakerResources
    });
  }

  // --- ARTS RESOURCES (2026-02-28: unified section with ordering + summary cards) ---
  // Check if this is an Artes segment with art types
  // 2026-03-07 FIX: Also check segment.data?.art_types for nested data structures
  const hasArtsData = (segment.art_types?.length > 0) || (segment.data?.art_types?.length > 0);
  
  // For non-Artes segments that happen to have video, show legacy video card
  // 2026-03-04 FIX: empty array [] is truthy — check .length
  const videoUrlRaw = segment.video_url;
  const hasVideoUrl = Array.isArray(videoUrlRaw) ? videoUrlRaw.length > 0 : !!videoUrlRaw;
  if (!hasArtsData && hasVideoUrl) {
    const videoUrls = Array.isArray(videoUrlRaw) ? videoUrlRaw : (typeof videoUrlRaw === 'string' ? videoUrlRaw.split(',').map(s=>s.trim()).filter(Boolean) : []);
    if (videoUrls.length > 0) {
      resources.push({
        category: t('resources.video'),
        items: videoUrls.map((url, index) => ({
          title: (segment.video_url_meta?.title || segment.video_name || 'Video') + (videoUrls.length > 1 ? ` ${index + 1}` : ''),
          subtitle: segment.video_location,
          url: url,
          thumbnail: segment.video_url_meta?.thumbnail,
          type: 'video',
          owner: segment.video_owner
        }))
      });
    }
  }

  // 2026-03-04 FIX: Also check arts data has actual content, not just empty arrays
  const hasResources = resources.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="w-4 h-4 text-pdv-teal" />
            {t('resources.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Speaker / non-arts resources (legacy cards) */}
          {resources.length > 0 && resources.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <Badge variant="outline" className="text-xs">
                {group.category}
              </Badge>
              <div className="space-y-2">
                {group.items.map((item, itemIdx) => (
                  <ResourceCard key={itemIdx} {...item} />
                ))}
              </div>
            </div>
          ))}

          {/* Arts-specific resources section (2026-02-28: ordered by performance sequence) */}
          {hasArtsData && (
            <ArtsResourcesSection segment={segment} language={language} />
          )}

          {/* Empty state only if nothing at all */}
          {!hasResources && !hasArtsData && (
            <div className="text-center py-6 text-gray-500">
              <ExternalLink className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">{t('resources.noResources')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}