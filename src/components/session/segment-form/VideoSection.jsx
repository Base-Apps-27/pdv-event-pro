/**
 * VideoSection.jsx
 * Phase 3B extraction: Video fields from SegmentFormTwoColumn "Contenido Específico".
 * Verbatim extraction — zero logic changes.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

export default function VideoSection({ formData, setFormData, isVideoType, isBreakType, isTechOnly }) {
  const { language } = useLanguage();

  if (formData.has_video) {
    return (
      <div className="space-y-3 bg-blue-50 p-4 rounded border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <Label className="font-semibold">Video</Label>
          {!isVideoType && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, has_video: false})} className="text-red-600">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Nombre del Video *</Label>
          <Input value={formData.video_name} onChange={(e) => setFormData({...formData, video_name: e.target.value})} placeholder="Video de Apertura" className="text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Ubicación</Label>
          <Input value={formData.video_location} onChange={(e) => setFormData({...formData, video_location: e.target.value})} placeholder="ProPresenter > Videos > Opening.mp4" className="text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">Propietario</Label>
            <Input value={formData.video_owner} onChange={(e) => setFormData({...formData, video_owner: e.target.value})} placeholder="PDV Media" className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Duración (seg)</Label>
            <Input type="number" value={formData.video_length_sec} onChange={(e) => setFormData({...formData, video_length_sec: parseInt(e.target.value) || 0})} placeholder="120" className="text-sm" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{language === 'es' ? 'Enlace al Video (URL)' : 'Video Link (URL)'}</Label>
          <Input value={formData.video_url} onChange={(e) => setFormData({...formData, video_url: e.target.value, video_url_meta: null})} placeholder="https://youtube.com/watch?v=..." className="h-9 text-sm" />
        </div>
      </div>
    );
  }

  // "Add Video" button
  if (!isVideoType && !isBreakType && !isTechOnly) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setFormData({...formData, has_video: true})} className="w-full">
        <Plus className="w-4 h-4 mr-2" />Añadir Video
      </Button>
    );
  }

  return null;
}