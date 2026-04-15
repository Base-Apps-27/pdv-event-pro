/**
 * WorshipSongsSection — Segment detail form song editor.
 * 2026-04-15: REWRITTEN to use SegmentSong entity.
 * Renders songs for a worship segment, with add/remove/reorder capabilities.
 *
 * Props:
 *   segmentId  — the Segment entity ID
 *   formData   — full segment form state (reads number_of_songs for legacy display)
 *   setFormData — state setter for formData (legacy compat only)
 */

import React, { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function WorshipSongsSection({ segmentId, formData, setFormData }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Load SegmentSong records
  const fetchSongs = useCallback(async () => {
    if (!segmentId) { setLoading(false); return; }
    try {
      const results = await base44.entities.SegmentSong.filter(
        { segment_id: segmentId }, 'order'
      );
      setSongs(results);
    } catch (err) {
      console.error('[WorshipSongsSection] Load failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [segmentId]);

  useEffect(() => { fetchSongs(); }, [fetchSongs]);

  const addSong = useCallback(async () => {
    if (!segmentId) return;
    setAdding(true);
    try {
      const created = await base44.entities.SegmentSong.create({
        segment_id: segmentId,
        order: songs.length + 1,
        title: '',
        lead: '',
        key: '',
      });
      setSongs(prev => [...prev, created]);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setAdding(false);
    }
  }, [segmentId, songs.length]);

  const updateField = useCallback(async (songId, field, value) => {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, [field]: value } : s));
    try {
      await base44.entities.SegmentSong.update(songId, { [field]: value });
    } catch (err) {
      console.error('[WorshipSongsSection] Update failed:', err.message);
    }
  }, []);

  const removeSong = useCallback(async (songId) => {
    setSongs(prev => prev.filter(s => s.id !== songId));
    try {
      await base44.entities.SegmentSong.delete(songId);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
      fetchSongs();
    }
  }, [fetchSongs]);

  const moveSong = useCallback(async (idx, direction) => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= songs.length) return;
    const newSongs = [...songs];
    [newSongs[idx], newSongs[targetIdx]] = [newSongs[targetIdx], newSongs[idx]];
    newSongs.forEach((s, i) => { s.order = i + 1; });
    setSongs(newSongs);
    try {
      await Promise.all([
        base44.entities.SegmentSong.update(newSongs[idx].id, { order: newSongs[idx].order }),
        base44.entities.SegmentSong.update(newSongs[targetIdx].id, { order: newSongs[targetIdx].order }),
      ]);
    } catch (err) {
      console.error('[WorshipSongsSection] Move failed:', err.message);
      fetchSongs();
    }
  }, [songs, fetchSongs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-purple-50 p-4 rounded border border-purple-200">
      <div className="flex items-center justify-between">
        <Label>Canciones ({songs.length})</Label>
        <Button variant="outline" size="sm" onClick={addSong} disabled={adding} className="h-7 text-xs">
          {adding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          Agregar
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-2 mb-1">
        <div className="col-span-1" />
        <Label className="col-span-4 text-xs">Título</Label>
        <Label className="col-span-3 text-xs">Vocalista</Label>
        <Label className="col-span-2 text-xs">Tono</Label>
        <div className="col-span-2" />
      </div>

      {songs.map((song, idx) => (
        <div key={song.id} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-1 flex flex-col items-center gap-0">
            <button onClick={() => moveSong(idx, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 h-3">
              <ChevronUp className="w-3 h-3" />
            </button>
            <span className="text-[9px] text-gray-400">{idx + 1}</span>
            <button onClick={() => moveSong(idx, 'down')} disabled={idx === songs.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 h-3">
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <Input
            className="col-span-4 text-sm"
            value={song.title || ''}
            onChange={(e) => updateField(song.id, 'title', e.target.value)}
            placeholder={`Canción ${idx + 1}`}
          />
          <Input
            className="col-span-3 text-sm"
            value={song.lead || ''}
            onChange={(e) => updateField(song.id, 'lead', e.target.value)}
            placeholder="Nombre"
          />
          <Input
            className="col-span-2 text-sm text-center"
            value={song.key || ''}
            onChange={(e) => updateField(song.id, 'key', e.target.value)}
            placeholder="Tono"
          />
          <div className="col-span-2 flex justify-center">
            <button onClick={() => removeSong(song.id)} className="text-red-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {songs.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-2">
          No hay canciones. Presiona "Agregar" para comenzar.
        </p>
      )}
    </div>
  );
}