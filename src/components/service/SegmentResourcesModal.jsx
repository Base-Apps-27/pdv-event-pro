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
  User
} from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

/**
 * ResourceCard - Displays a single resource with thumbnail and metadata
 */
function ResourceCard({ title, subtitle, url, thumbnail, type, owner }) {
  const { t } = useLanguage();
  
  if (!url) return null;

  const getIcon = () => {
    switch (type) {
      case 'video': return <Video className="w-5 h-5 text-blue-600" />;
      case 'song': return <Music className="w-5 h-5 text-pink-600" />;
      case 'pdf': return <FileText className="w-5 h-5 text-red-600" />;
      default: return <ExternalLink className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActionLabel = () => {
    switch (type) {
      case 'video': return t('resources.play');
      case 'song': return t('resources.play');
      case 'pdf': return t('resources.viewPdf');
      default: return t('resources.open');
    }
  };

  return (
    <div className="flex gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      {/* Thumbnail */}
      {thumbnail ? (
        <img 
          src={thumbnail} 
          alt={title}
          className="w-24 h-16 object-cover rounded flex-shrink-0 bg-gray-100"
          onError={(e) => { 
            e.target.onerror = null;
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" fill="%23e5e7eb"><rect width="96" height="64"/></svg>';
          }}
        />
      ) : (
        <div className="w-24 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
          {getIcon()}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {getIcon()}
              <h4 className="font-medium text-gray-900 truncate text-sm">
                {title || url}
              </h4>
            </div>
            {subtitle && (
              <p className="text-xs text-gray-600 mt-0.5 truncate">{subtitle}</p>
            )}
            {owner && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                {owner}
              </p>
            )}
          </div>
          
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <Button size="sm" variant="outline" className="h-8 gap-1">
              <Play className="w-3 h-3" />
              {getActionLabel()}
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SegmentResourcesModal({ open, onOpenChange, segment }) {
  const { t, language } = useLanguage();

  if (!segment) return null;

  // Collect all resources
  const resources = [];

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
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-pdv-teal" />
            {t('resources.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {!hasResources ? (
            <div className="text-center py-8 text-gray-500">
              <ExternalLink className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>{t('resources.noResources')}</p>
            </div>
          ) : (
            resources.map((group, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {group.category}
                  </Badge>
                </h3>
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