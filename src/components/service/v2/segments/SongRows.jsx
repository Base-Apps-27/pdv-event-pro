/**
 * SongRows.jsx — V2 song input rows for worship segments.
 * HARDENING (Phase 9):
 *   - Memoized with React.memo
 *   - Print: read-only song list
 *   - Song row numbering with accent color
 *   - Better sync with entity: tracks all 10 song slots (2026-03-26: expanded from 6)
 */

import React, { useState, useEffect, useCallback, memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Music } from "lucide-react";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { useLanguage } from "@/components/utils/i18n.jsx";

/**
 * Extract songs array from flat segment entity fields.
 */
function getSongsFromEntity(segment) {
  const count = segment.number_of_songs || 4;
  const songs = [];
  for (let i = 1; i <= Math.max(count, 1); i++) {
    songs.push({
      title: segment[`song_${i}_title`] || '',
      lead: segment[`song_${i}_lead`] || '',
      key: segment[`song_${i}_key`] || '',
    });
  }
  while (songs.length < count) {
    songs.push({ title: '', lead: '', key: '' });
  }
  return songs;
}

export default memo(function SongRows({ segment, onWriteSongs, canEdit = true }) {
  const { t } = useLanguage();
  const [songs, setSongs] = useState(() => getSongsFromEntity(segment));

  // Sync from entity when segment changes — tracks all 10 song slots (2026-03-26)
  useEffect(() => {
    setSongs(getSongsFromEntity(segment));
  }, [
    segment.id,
    segment.number_of_songs,
    segment.song_1_title, segment.song_2_title, segment.song_3_title,
    segment.song_4_title, segment.song_5_title, segment.song_6_title,
    segment.song_7_title, segment.song_8_title, segment.song_9_title, segment.song_10_title,
    segment.song_1_lead, segment.song_2_lead, segment.song_3_lead,
    segment.song_4_lead, segment.song_5_lead, segment.song_6_lead,
    segment.song_7_lead, segment.song_8_lead, segment.song_9_lead, segment.song_10_lead,
  ]);

  const updateSong = useCallback((idx, field, value) => {
    setSongs(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      onWriteSongs(segment.id, next);
      return next;
    });
  }, [segment.id, onWriteSongs]);

  const addSlot = useCallback(() => {
    if (songs.length >= 10) return;
    const next = [...songs, { title: '', lead: '', key: '' }];
    setSongs(next);
    onWriteSongs(segment.id, next);
  }, [songs, segment.id, onWriteSongs]);

  const removeSlot = useCallback(() => {
    if (songs.length <= 1) return;
    const next = songs.slice(0, -1);
    setSongs(next);
    onWriteSongs(segment.id, next);
  }, [songs, segment.id, onWriteSongs]);

  const filledSongs = songs.filter(s => s.title);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
          <Music className="w-3 h-3" />
          {t('songs.title')}
        </Label>
        {canEdit && (
          <div className="flex items-center gap-1 print:hidden">
            <span className="text-[10px] text-gray-400">{songs.length}</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={removeSlot} disabled={songs.length <= 1} title={t('songs.removeSong')}>
              <Minus className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={addSlot} disabled={songs.length >= 10} title={t('songs.addSong')}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Screen: editable */}
      <div className="print:hidden space-y-1">
        {songs.map((song, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2">
            <div className="col-span-5">
              <AutocompleteInput
                type="songTitle"
                placeholder={t('songs.songN').replace('{n}', idx + 1)}
                value={song.title}
                onChange={(e) => updateSong(idx, 'title', e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="col-span-5">
              <AutocompleteInput
                type="worshipLeader"
                placeholder={t('songs.lead')}
                value={song.lead}
                onChange={(e) => updateSong(idx, 'lead', e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="col-span-2">
              <Input
                placeholder={t('songs.key')}
                value={song.key}
                onChange={(e) => updateSong(idx, 'key', e.target.value)}
                className="text-xs px-1 text-center"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Print: read-only */}
      {filledSongs.length > 0 && (
        <div className="hidden print:block space-y-0.5">
          {filledSongs.map((song, idx) => (
            <div key={idx} className="text-xs text-gray-800">
              <span className="font-semibold">{idx + 1}.</span> {song.title}
              {song.lead && <span className="text-gray-600"> — {song.lead}</span>}
              {song.key && <span className="text-gray-500"> ({song.key})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});