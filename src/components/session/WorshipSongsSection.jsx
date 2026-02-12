import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/**
 * WorshipSongsSection — Extracted from SegmentFormTwoColumn (Phase 3B).
 * Renders the song title + vocalist grid for Alabanza segments.
 * 
 * Props:
 *   formData     — full segment form state (reads number_of_songs, song_N_title, song_N_lead)
 *   setFormData  — state setter for formData
 */
export default function WorshipSongsSection({ formData, setFormData }) {
  return (
    <div className="space-y-3 bg-purple-50 p-4 rounded border border-purple-200">
      <div className="flex items-center justify-between">
        <Label>Canciones</Label>
        <div className="flex items-center gap-2">
          <Label className="text-xs">#</Label>
          <Input 
            type="number"
            min="1"
            max="6"
            value={formData.number_of_songs}
            onChange={(e) => setFormData({...formData, number_of_songs: parseInt(e.target.value) || 1})}
            className="w-16 h-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-1">
        <Label className="text-xs">Título</Label>
        <Label className="text-xs">Vocalista</Label>
      </div>

      {[...Array(formData.number_of_songs || 0)].map((_, idx) => {
        const songNum = idx + 1;
        return (
          <div key={songNum} className="grid grid-cols-2 gap-2">
            <Input 
              value={formData[`song_${songNum}_title`]}
              onChange={(e) => setFormData({...formData, [`song_${songNum}_title`]: e.target.value})}
              placeholder={`Canción ${songNum}`}
              className="text-sm"
            />
            <Input 
              value={formData[`song_${songNum}_lead`]}
              onChange={(e) => setFormData({...formData, [`song_${songNum}_lead`]: e.target.value})}
              placeholder="Nombre"
              className="text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}