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
import { useLanguage } from "@/components/utils/i18n";
import { getSegmentData } from "@/components/utils/segmentDataUtils";

/**
 * ResourceCard - Displays a single resource with thumbnail and metadata
 */
function ResourceCard({ title, subtitle, url, thumbnail, type, owner, icon, action }) {
  const { t } = useLanguage();
  
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
            {title || url}
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
          <Play className="w-3 h-3" />
          {getActionLabel()}
        </Button>
      </div>
    </a>
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
  const presentationUrl = getData('presentation_url');
  const notesUrl = getData('notes_url');
  const parsedVerses = getData('parsed_verse_data');
  const hasKeyTakeaways = parsedVerses?.key_takeaways?.length > 0;
  
  if (presentationUrl) {
    speakerResources.push({
      title: language === 'es' ? 'Presentación (Slides)' : 'Presentation Slides',
      url: presentationUrl,
      type: 'slides',
      icon: <Monitor className="w-4 h-4 text-blue-600" />
    });
  }

  if (notesUrl) {
    speakerResources.push({
      title: language === 'es' ? 'Notas del Orador' : 'Speaker Notes',
      url: notesUrl,
      type: 'notes',
      icon: <FileText className="w-4 h-4 text-purple-600" />
    });
  }

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

  // Video
  if (segment.video_url) {
    resources.push({
      category: t('resources.video'),
      items: [{
        title: segment.video_url_meta?.title || segment.video_name || 'Video',
        subtitle: segment.video_location,
        url: segment.video_url,
        thumbnail: segment.video_url_meta?.thumbnail,
        type: 'video',
        owner: segment.video_owner
      }]
    });
  }

  // Drama Songs (up to 3)
  const dramaSongs = [];
  if (segment.drama_song_source) {
    dramaSongs.push({
      title: segment.drama_song_1_url_meta?.title || segment.drama_song_title || `${t('resources.songNumber').replace('{n}', '1')}`,
      url: segment.drama_song_source,
      thumbnail: segment.drama_song_1_url_meta?.thumbnail,
      type: 'song',
      owner: segment.drama_song_owner
    });
  }
  if (segment.drama_song_2_url) {
    dramaSongs.push({
      title: segment.drama_song_2_url_meta?.title || segment.drama_song_2_title || `${t('resources.songNumber').replace('{n}', '2')}`,
      url: segment.drama_song_2_url,
      thumbnail: segment.drama_song_2_url_meta?.thumbnail,
      type: 'song',
      owner: segment.drama_song_2_owner
    });
  }
  if (segment.drama_song_3_url) {
    dramaSongs.push({
      title: segment.drama_song_3_url_meta?.title || segment.drama_song_3_title || `${t('resources.songNumber').replace('{n}', '3')}`,
      url: segment.drama_song_3_url,
      thumbnail: segment.drama_song_3_url_meta?.thumbnail,
      type: 'song',
      owner: segment.drama_song_3_owner
    });
  }
  if (dramaSongs.length > 0) {
    resources.push({
      category: t('resources.dramaSongs'),
      items: dramaSongs
    });
  }

  // Dance Songs (up to 3)
  const danceSongs = [];
  if (segment.dance_song_source) {
    danceSongs.push({
      title: segment.dance_song_1_url_meta?.title || segment.dance_song_title || `${t('resources.songNumber').replace('{n}', '1')}`,
      url: segment.dance_song_source,
      thumbnail: segment.dance_song_1_url_meta?.thumbnail,
      type: 'song',
      owner: segment.dance_song_owner
    });
  }
  if (segment.dance_song_2_url) {
    danceSongs.push({
      title: segment.dance_song_2_url_meta?.title || segment.dance_song_2_title || `${t('resources.songNumber').replace('{n}', '2')}`,
      url: segment.dance_song_2_url,
      thumbnail: segment.dance_song_2_url_meta?.thumbnail,
      type: 'song',
      owner: segment.dance_song_2_owner
    });
  }
  if (segment.dance_song_3_url) {
    danceSongs.push({
      title: segment.dance_song_3_url_meta?.title || segment.dance_song_3_title || `${t('resources.songNumber').replace('{n}', '3')}`,
      url: segment.dance_song_3_url,
      thumbnail: segment.dance_song_3_url_meta?.thumbnail,
      type: 'song',
      owner: segment.dance_song_3_owner
    });
  }
  if (danceSongs.length > 0) {
    resources.push({
      category: t('resources.danceSongs'),
      items: danceSongs
    });
  }

  // Arts Directions PDF
  if (segment.arts_run_of_show_url) {
    resources.push({
      category: language === 'es' ? 'Guía de Artes' : 'Arts Directions',
      items: [{
        title: segment.arts_run_of_show_url_meta?.title || (language === 'es' ? 'Guía de Artes' : 'Arts Directions'),
        url: segment.arts_run_of_show_url,
        type: 'pdf'
      }]
    });
  }

  const hasResources = resources.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="w-4 h-4 text-pdv-teal" />
            {t('resources.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {!hasResources ? (
            <div className="text-center py-6 text-gray-500">
              <ExternalLink className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">{t('resources.noResources')}</p>
            </div>
          ) : (
            resources.map((group, idx) => (
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
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}