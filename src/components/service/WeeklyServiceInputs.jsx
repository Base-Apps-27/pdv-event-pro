import React, { useContext, createContext } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { getSegmentData } from "@/components/utils/segmentDataUtils";

/**
 * WeeklyServiceInputs — Extracted from WeeklyServiceManager (Phase 3A).
 * SIMPLIFIED SAVE (2026-02-22): All inputs now use direct onChange → setState.
 * No local state, no debouncing, no blur commits.
 * 5s debounced timer in WeeklyServiceManager handles batched DB writes.
 *
 * Exports:
 *   ServiceDataContext, UpdatersContext — React contexts for state sharing
 *   SongInputRow, PreServiceNotesInput, RecesoNotesInput, TeamInput,
 *   SegmentTextInput, SegmentTextarea, SegmentAutocomplete
 */

// Contexts for sharing serviceData and updaters
export const ServiceDataContext = createContext(null);
export const UpdatersContext = createContext(null);

// Song Input Row - direct state updates
export function SongInputRow({ service, segmentIndex, songIndex }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const song = segment?.songs?.[songIndex] || { title: "", lead: "", key: "" };
  const { updateSegmentField } = useContext(UpdatersContext);

  const handleSongChange = (field, value) => {
    const songs = segment?.songs || [];
    const updated = [...songs];
    updated[songIndex] = { ...updated[songIndex], [field]: value };
    updateSegmentField(service, segmentIndex, "songs", updated);
  };

  return (
    <div className="grid grid-cols-12 gap-2">
      <div className="col-span-5">
        <AutocompleteInput
          type="songTitle"
          placeholder={`Canción ${songIndex + 1}`}
          value={song.title}
          onChange={(e) => handleSongChange("title", e.target.value)}
          className="text-xs"
        />
      </div>
      <div className="col-span-5">
        <AutocompleteInput
          type="worshipLeader"
          placeholder="Líder"
          value={song.lead}
          onChange={(e) => handleSongChange("lead", e.target.value)}
          className="text-xs"
        />
      </div>
      <div className="col-span-2">
        <Input
          placeholder="Tono"
          value={song.key}
          onChange={(e) => handleSongChange("key", e.target.value)}
          className="text-xs px-1 text-center"
        />
      </div>
    </div>
  );
}

// Pre-Service Notes Input - direct state updates
export function PreServiceNotesInput({ service }) {
  const serviceData = useContext(ServiceDataContext);
  const notes = serviceData?.pre_service_notes?.[service] || "";
  const { setServiceData } = useContext(UpdatersContext);

  const handleChange = (val) => {
    setServiceData(prev => ({
      ...prev,
      pre_service_notes: {
        ...prev.pre_service_notes,
        [service]: val
      }
    }));
  };

  return (
    <Textarea
      placeholder="Instrucciones pre-servicio (opcional)..."
      value={notes}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
      rows={2}
    />
  );
}

// Receso Notes Input - direct state updates
export function RecesoNotesInput({ slotName }) {
  const serviceData = useContext(ServiceDataContext);
  const resolvedSlot = slotName || (serviceData?.receso_notes ? Object.keys(serviceData.receso_notes)[0] : null);
  if (!resolvedSlot) return null;
  const notes = serviceData?.receso_notes?.[resolvedSlot] || "";
  const { setServiceData } = useContext(UpdatersContext);

  const handleChange = (val) => {
    setServiceData(prev => ({
      ...prev,
      receso_notes: {
        ...prev.receso_notes,
        [resolvedSlot]: val
      }
    }));
  };

  return (
    <Textarea
      placeholder="Notas del receso (opcional)..."
      value={notes}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
      rows={2}
    />
  );
}

// Team Input Component - direct state updates
export function TeamInput({ field, service, placeholder }) {
  const value = useContext(ServiceDataContext)?.[field]?.[service] || "";
  const { updateTeamField } = useContext(UpdatersContext);

  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => updateTeamField(field, service, e.target.value)}
      className="text-xs"
    />
  );
}

// Segment Field Component - direct state updates
export function SegmentTextInput({ service, segmentIndex, field, placeholder, className = "text-sm" }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const value = getSegmentData(segment, field) || "";
  const { updateSegmentField } = useContext(UpdatersContext);

  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => updateSegmentField(service, segmentIndex, field, e.target.value)}
      className={className}
    />
  );
}

// Segment Textarea Component - direct state updates
export function SegmentTextarea({ service, segmentIndex, field, placeholder, className = "text-sm", rows = 2 }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const value = getSegmentData(segment, field) || "";
  const { updateSegmentField } = useContext(UpdatersContext);

  return (
    <Textarea
      placeholder={placeholder}
      value={value}
      onChange={(e) => updateSegmentField(service, segmentIndex, field, e.target.value)}
      className={className}
      rows={rows}
    />
  );
}

// Segment Autocomplete Component - direct state updates
export function SegmentAutocomplete({ service, segmentIndex, field, placeholder, type, className = "text-sm" }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const value = getSegmentData(segment, field) || "";
  const { updateSegmentField } = useContext(UpdatersContext);

  return (
    <AutocompleteInput
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => updateSegmentField(service, segmentIndex, field, e.target.value)}
      className={className}
    />
  );
}