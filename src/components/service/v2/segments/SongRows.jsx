/**
 * SongRows.jsx — V2 song input rows for worship segments.
 * Reads song data from flat entity fields (song_1_title, etc.).
 * Writes via onWriteSongs(segmentId, songsArray).
 */

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import AutocompleteInput from "@/components/ui/AutocompleteInput";

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
  // Ensure at least the right number of slots
  while (songs.length < count) {
    songs.push({ title: '', lead: '', key: '' });
  }
  return songs;
}

export default function SongRows({ segment, onWriteSongs, canEdit = true }) {
  const [songs, setSongs] = useState(() => getSongsFromEntity(segment));

  // Sync from entity when segment changes (e.g., after external reload)
  useEffect(() => {
    setSongs(getSongsFromEntity(segment));
  }, [
    segment.id,
    segment.number_of_songs,
    segment.song_1_title, segment.song_2_title, segment.song_3_title,
    segment.song_4_title, segment.song_5_title, segment.song_6_title,
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

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-700">Canciones</Label>
        {canEdit && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">{songs.length}</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={removeSlot} disabled={songs.length <= 1} title="Quitar canción">
              <Minus className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={addSlot} disabled={songs.length >= 10} title="Agregar canción">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
      {songs.map((song, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2">
          <div className="col-span-5">
            <AutocompleteInput
              type="songTitle"
              placeholder={`Canción ${idx + 1}`}
              value={song.title}
              onChange={(e) => updateSong(idx, 'title', e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="col-span-5">
            <AutocompleteInput
              type="worshipLeader"
              placeholder="Líder"
              value={song.lead}
              onChange={(e) => updateSong(idx, 'lead', e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="col-span-2">
            <Input
              placeholder="Tono"
              value={song.key}
              onChange={(e) => updateSong(idx, 'key', e.target.value)}
              className="text-xs px-1 text-center"
            />
          </div>
        </div>
      ))}
    </div>
  );
}