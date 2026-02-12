import React, { useState, useEffect, useContext, createContext } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { useDebouncedCommit } from "@/components/utils/useDebouncedCommit";

/**
 * WeeklyServiceInputs — Extracted from WeeklyServiceManager (Phase 3A).
 * Contains all debounced input components that share ServiceDataContext/UpdatersContext.
 *
 * Exports:
 *   ServiceDataContext, UpdatersContext — React contexts for state sharing
 *   SongInputRow, PreServiceNotesInput, RecesoNotesInput, TeamInput,
 *   SegmentTextInput, SegmentTextarea, SegmentAutocomplete
 */

// Contexts for sharing serviceData and updaters
export const ServiceDataContext = createContext(null);
export const UpdatersContext = createContext(null);

// Song Input Row with local state
export function SongInputRow({ service, segmentIndex, songIndex }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const song = segment?.songs?.[songIndex] || { title: "", lead: "", key: "" };
  const updateSegmentField = useContext(UpdatersContext)?.updateSegmentField;
  
  const [localTitle, setLocalTitle] = useState("");
  const [localLead, setLocalLead] = useState("");
  const [localKey, setLocalKey] = useState("");
  
  const commitTitle = useDebouncedCommit(
    localTitle,
    song.title,
    (val) => {
      const newSongs = [...(segment.songs || [])];
      newSongs[songIndex] = { ...newSongs[songIndex], title: val };
      updateSegmentField(service, segmentIndex, "songs", newSongs);
    },
    3000
  );
  
  const commitLead = useDebouncedCommit(
    localLead,
    song.lead,
    (val) => {
      const newSongs = [...(segment.songs || [])];
      newSongs[songIndex] = { ...newSongs[songIndex], lead: val };
      updateSegmentField(service, segmentIndex, "songs", newSongs);
    },
    3000
  );

  const commitKey = useDebouncedCommit(
    localKey,
    song.key,
    (val) => {
      const newSongs = [...(segment.songs || [])];
      newSongs[songIndex] = { ...newSongs[songIndex], key: val };
      updateSegmentField(service, segmentIndex, "songs", newSongs);
    },
    3000
  );
  
  useEffect(() => {
    setLocalTitle(song.title);
    setLocalLead(song.lead);
    setLocalKey(song.key || "");
  }, [song.title, song.lead, song.key]);
  
  return (
    <div className="grid grid-cols-12 gap-2">
      <div className="col-span-5">
        <AutocompleteInput
          type="songTitle"
          placeholder={`Canción ${songIndex + 1}`}
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={commitTitle}
          className="text-xs"
        />
      </div>
      <div className="col-span-5">
        <AutocompleteInput
          type="worshipLeader"
          placeholder="Líder"
          value={localLead}
          onChange={(e) => setLocalLead(e.target.value)}
          onBlur={commitLead}
          className="text-xs"
        />
      </div>
      <div className="col-span-2">
        <Input
          placeholder="Tono"
          value={localKey}
          onChange={(e) => setLocalKey(e.target.value)}
          onBlur={commitKey}
          className="text-xs px-1 text-center"
        />
      </div>
    </div>
  );
}

// Pre-Service Notes Input with local state
export function PreServiceNotesInput({ service }) {
  const currentGlobalValue = useContext(ServiceDataContext)?.pre_service_notes?.[service] || "";
  const setServiceData = useContext(UpdatersContext)?.setServiceData;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => {
      setServiceData(prev => ({
        ...prev,
        pre_service_notes: { 
          ...prev.pre_service_notes, 
          [service]: val 
        }
      }));
    },
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Textarea
      placeholder="Instrucciones pre-servicio (opcional)..."
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
      rows={2}
    />
  );
}

// Receso Notes Input with local state
export function RecesoNotesInput() {
  const currentGlobalValue = useContext(ServiceDataContext)?.receso_notes?.["9:30am"] || "";
  const setServiceData = useContext(UpdatersContext)?.setServiceData;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => {
      setServiceData(prev => ({
        ...prev,
        receso_notes: { 
          ...prev.receso_notes, 
          "9:30am": val 
        }
      }));
    },
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Textarea
      placeholder="Notas del receso (opcional)..."
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
      rows={2}
    />
  );
}

// Team Input Component with local state
export function TeamInput({ field, service, placeholder }) {
  const currentGlobalValue = useContext(ServiceDataContext)?.[field]?.[service] || "";
  const updateTeamField = useContext(UpdatersContext)?.updateTeamField;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => updateTeamField(field, service, val),
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Input
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className="text-xs"
    />
  );
}

// Segment Field Component with local state (for simple text inputs)
export function SegmentTextInput({ service, segmentIndex, field, placeholder, className = "text-sm" }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  
  const rootFields = ['presentation_url', 'notes_url'];
  const isRoot = rootFields.includes(field);
  
  const currentGlobalValue = isRoot ? (segment?.[field] || "") : (segment?.data?.[field] || "");
  const updateSegmentField = useContext(UpdatersContext)?.updateSegmentField;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => updateSegmentField(service, segmentIndex, field, val),
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Input
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className={className}
    />
  );
}

// Segment Textarea Component with local state
export function SegmentTextarea({ service, segmentIndex, field, placeholder, className = "text-sm", rows = 2 }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const currentGlobalValue = segment?.data?.[field] || "";
  const updateSegmentField = useContext(UpdatersContext)?.updateSegmentField;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => updateSegmentField(service, segmentIndex, field, val),
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <Textarea
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className={className}
      rows={rows}
    />
  );
}

// Segment Autocomplete Component with local state
export function SegmentAutocomplete({ service, segmentIndex, field, placeholder, type, className = "text-sm" }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const currentGlobalValue = segment?.data?.[field] || "";
  const updateSegmentField = useContext(UpdatersContext)?.updateSegmentField;
  const [localValue, setLocalValue] = useState("");
  
  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => updateSegmentField(service, segmentIndex, field, val),
    3000
  );
  
  useEffect(() => {
    setLocalValue(currentGlobalValue);
  }, [currentGlobalValue]);
  
  return (
    <AutocompleteInput
      type={type}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitNow}
      className={className}
    />
  );
}