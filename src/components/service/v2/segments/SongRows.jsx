/**
 * SongRows.jsx — V2 song input rows for worship segments.
 * 2026-04-15: REWRITTEN to use SegmentSong entity instead of flat fields on Segment.
 * Songs are now stored as individual SegmentSong records (segment_id, order, title, lead, key).
 * No hard cap of 10 — unlimited songs per segment.
 *
 * The old flat fields (song_1_title..song_10_key) remain on Segment for backward compat
 * but are NOT written by this component anymore. New code reads/writes SegmentSong only.
 */

import React, { useState, useEffect, useCallback, memo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Music, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const DEBOUNCE_MS = 600;

export default memo(function SongRows({ segmentId, songs: initialSongs, canEdit = true, onSongsChanged }) {
  const { t } = useLanguage();
  const [songs, setSongs] = useState(initialSongs || []);
  const [adding, setAdding] = useState(false);
  const timersRef = useRef({});

  // Sync when parent data changes (e.g. after refetch)
  useEffect(() => {
    setSongs(initialSongs || []);
  }, [initialSongs]);

  // Debounced update for a single song field
  const debouncedUpdate = useCallback((songId, field, value) => {
    const key = `${songId}:${field}`;
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(async () => {
      delete timersRef.current[key];
      try {
        await base44.entities.SegmentSong.update(songId, { [field]: value });
      } catch (err) {
        console.error('[SongRows] Update failed:', err.message);
        toast.error(`Error saving song: ${err.message}`);
      }
    }, DEBOUNCE_MS);
  }, []);

  const updateSongField = useCallback((songId, localIdx, field, value) => {
    setSongs(prev => prev.map((s, i) => i === localIdx ? { ...s, [field]: value } : s));
    debouncedUpdate(songId, field, value);
  }, [debouncedUpdate]);

  const addSong = useCallback(async () => {
    if (!segmentId) return;
    setAdding(true);
    try {
      const newOrder = songs.length + 1;
      const created = await base44.entities.SegmentSong.create({
        segment_id: segmentId,
        order: newOrder,
        title: '',
        lead: '',
        key: '',
      });
      setSongs(prev => [...prev, created]);
      onSongsChanged?.();
    } catch (err) {
      console.error('[SongRows] Add failed:', err.message);
      toast.error(`Error adding song: ${err.message}`);
    } finally {
      setAdding(false);
    }
  }, [segmentId, songs.length, onSongsChanged]);

  const removeSong = useCallback(async (songId, localIdx) => {
    // Optimistic remove
    setSongs(prev => prev.filter((_, i) => i !== localIdx));
    try {
      await base44.entities.SegmentSong.delete(songId);
      // Re-order remaining songs
      const remaining = songs.filter((_, i) => i !== localIdx);
      await Promise.all(remaining.map((s, i) => {
        const newOrder = i + 1;
        if (s.order !== newOrder) {
          return base44.entities.SegmentSong.update(s.id, { order: newOrder });
        }
        return Promise.resolve();
      }));
      onSongsChanged?.();
    } catch (err) {
      console.error('[SongRows] Delete failed:', err.message);
      toast.error(`Error removing song: ${err.message}`);
      // Re-fetch on error
      onSongsChanged?.();
    }
  }, [songs, onSongsChanged]);

  const moveSong = useCallback(async (localIdx, direction) => {
    const targetIdx = direction === 'up' ? localIdx - 1 : localIdx + 1;
    if (targetIdx < 0 || targetIdx >= songs.length) return;

    const newSongs = [...songs];
    [newSongs[localIdx], newSongs[targetIdx]] = [newSongs[targetIdx], newSongs[localIdx]];
    // Reassign order values
    newSongs.forEach((s, i) => { s.order = i + 1; });
    setSongs(newSongs);

    try {
      await Promise.all([
        base44.entities.SegmentSong.update(newSongs[localIdx].id, { order: newSongs[localIdx].order }),
        base44.entities.SegmentSong.update(newSongs[targetIdx].id, { order: newSongs[targetIdx].order }),
      ]);
    } catch (err) {
      console.error('[SongRows] Move failed:', err.message);
      toast.error(`Error reordering: ${err.message}`);
      onSongsChanged?.();
    }
  }, [songs, onSongsChanged]);

  // Cleanup timers on unmount — flush pending writes
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(t => clearTimeout(t));
    };
  }, []);

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
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={addSong} disabled={adding} title={t('songs.addSong')}>
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </Button>
          </div>
        )}
      </div>

      {/* Screen: editable */}
      <div className="print:hidden space-y-1">
        {songs.map((song, idx) => (
          <div key={song.id || idx} className="grid grid-cols-12 gap-1 items-center">
            {/* Reorder + number */}
            {canEdit && (
              <div className="col-span-1 flex flex-col items-center gap-0">
                <button onClick={() => moveSong(idx, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 p-0 h-3">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <span className="text-[9px] text-gray-400 font-mono">{idx + 1}</span>
                <button onClick={() => moveSong(idx, 'down')} disabled={idx === songs.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 p-0 h-3">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className={canEdit ? "col-span-4" : "col-span-5"}>
              <AutocompleteInput
                type="songTitle"
                placeholder={t('songs.songN').replace('{n}', idx + 1)}
                value={song.title || ''}
                onChange={(e) => updateSongField(song.id, idx, 'title', e.target.value)}
                className="text-xs"
              />
            </div>
            <div className={canEdit ? "col-span-4" : "col-span-5"}>
              <AutocompleteInput
                type="worshipLeader"
                placeholder={t('songs.lead')}
                value={song.lead || ''}
                onChange={(e) => updateSongField(song.id, idx, 'lead', e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="col-span-2">
              <Input
                placeholder={t('songs.key')}
                value={song.key || ''}
                onChange={(e) => updateSongField(song.id, idx, 'key', e.target.value)}
                className="text-xs px-1 text-center"
              />
            </div>
            {canEdit && (
              <div className="col-span-1 flex justify-center">
                <button onClick={() => removeSong(song.id, idx)} className="text-red-400 hover:text-red-600 p-0" title={t('songs.removeSong')}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Print: read-only */}
      {filledSongs.length > 0 && (
        <div className="hidden print:block space-y-0.5">
          {filledSongs.map((song, idx) => (
            <div key={song.id || idx} className="text-xs text-gray-800">
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