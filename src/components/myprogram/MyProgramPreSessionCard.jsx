/**
 * MyProgramPreSessionCard
 * 
 * Displays pre-session details (Spotify, Slide Loop, WiFi, etc.) at the top of the timeline.
 * Matches the styling of MyProgramSegmentCard.
 */
import React from 'react';
import { Music, Monitor, Wifi, Info } from 'lucide-react';
import { useLanguage } from '@/components/utils/i18n';

export default function MyProgramPreSessionCard({ details }) {
  const { t } = useLanguage();

  if (!details) return null;

  const { spotify_playlist, slide_loop_name, wifi_network, wifi_password, notes } = details;

  if (!spotify_playlist && !slide_loop_name && !wifi_network && !notes) return null;

  return (
    <div className="relative mb-6 pl-6 sm:pl-8">
      {/* Timeline Dot (Start) */}
      <div className="absolute left-[0.65rem] sm:left-[0.85rem] top-4 w-3 h-3 bg-gray-300 rounded-full z-10 border-2 border-white box-content" />
      
      {/* Content Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Info className="w-3 h-3" />
          Pre-Session Details
        </h4>

        <div className="space-y-3">
          {spotify_playlist && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <Music className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Spotify Playlist</p>
                <p className="text-sm font-medium text-gray-900">{spotify_playlist}</p>
              </div>
            </div>
          )}

          {slide_loop_name && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Monitor className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Slide Loop</p>
                <p className="text-sm font-medium text-gray-900">{slide_loop_name}</p>
              </div>
            </div>
          )}

          {(wifi_network || wifi_password) && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Wifi className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">WiFi</p>
                <p className="text-sm font-medium text-gray-900">
                  {wifi_network} {wifi_password ? ` • ${wifi_password}` : ''}
                </p>
              </div>
            </div>
          )}

          {notes && (
            <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
              {notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}