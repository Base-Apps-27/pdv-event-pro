import React, { useState, useEffect, useContext, useCallback, createContext } from "react";
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
// SONG-OVERWRITE-FIX (2026-02-20): Each field commits only its own value using
// setServiceData functional updater to read latest state. This prevents saving
// one field from overwriting another field's in-progress local edits.
// PER-FIELD-PUSH (2026-02-21): After updating state, pushes the updated songs
// array directly to the Segment entity. Fire-and-forget, non-blocking.
export function SongInputRow({ service, segmentIndex, songIndex }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const song = segment?.songs?.[songIndex] || { title: "", lead: "", key: "" };
  const setServiceData = useContext(UpdatersContext)?.setServiceData;
  const pushFn = useContext(UpdatersContext)?.pushFn;
  // Stable entity ID (set during init, doesn't change between field edits)
  const entityId = segment?._entityId;

  const [localTitle, setLocalTitle] = useState("");
  const [localLead, setLocalLead] = useState("");
  const [localKey, setLocalKey] = useState("");

  // Helper: update a single song sub-field using functional updater (always reads latest state)
  const commitSongField = useCallback((fieldName, val) => {
    let updatedSongs = null;
    setServiceData(prev => {
      const newServiceArray = [...(prev[service] || [])];
      if (!newServiceArray[segmentIndex]) return prev;
      const newSegment = { ...newServiceArray[segmentIndex] };
      const newSongs = [...(newSegment.songs || [])];
      newSongs[songIndex] = { ...newSongs[songIndex], [fieldName]: val };
      newSegment.songs = newSongs;
      newServiceArray[segmentIndex] = newSegment;
      updatedSongs = newSongs; // Capture for push
      return { ...prev, [service]: newServiceArray };
    });
    // Per-field push: send updated songs to entity (fire-and-forget)
    if (pushFn && entityId && updatedSongs) {
      pushFn("songs", { entityId, songs: updatedSongs });
    }
  }, [service, segmentIndex, songIndex, setServiceData, pushFn, entityId]);
  
  const commitTitle = useDebouncedCommit(
    localTitle,
    song.title,
    (val) => commitSongField('title', val),
    3000
  );
  
  const commitLead = useDebouncedCommit(
    localLead,
    song.lead,
    (val) => commitSongField('lead', val),
    3000
  );

  const commitKey = useDebouncedCommit(
    localKey,
    song.key,
    (val) => commitSongField('key', val),
    3000
  );
  
  // Separate sync effects per field so committing one doesn't overwrite another's local edits
  useEffect(() => { setLocalTitle(song.title); }, [song.title]);
  useEffect(() => { setLocalLead(song.lead); }, [song.lead]);
  useEffect(() => { setLocalKey(song.key || ""); }, [song.key]);
  
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
// PER-FIELD-PUSH (2026-02-21): Pushes notes to PreSessionDetails entity.
export function PreServiceNotesInput({ service }) {
  const serviceData = useContext(ServiceDataContext);
  const currentGlobalValue = serviceData?.pre_service_notes?.[service] || "";
  const setServiceData = useContext(UpdatersContext)?.setServiceData;
  const pushFn = useContext(UpdatersContext)?.pushFn;
  // Session ID for this slot (for PreSessionDetails push)
  const sessionId = serviceData?._sessionIds?.[service]
    || serviceData?.[service]?.[0]?._sessionId;
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
      // Per-field push
      if (pushFn && sessionId) {
        pushFn("preNotes", { sessionId, value: val });
      }
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
// Entity Lift: accepts slotName prop (defaults to first slot key in receso_notes)
// PER-FIELD-PUSH (2026-02-21): receso_notes lives on Service entity (not session),
// so we push via the "serviceField" type. The safety-net full sync also covers this.
export function RecesoNotesInput({ slotName }) {
  const serviceData = useContext(ServiceDataContext);
  // Resolve slot: use prop if provided, else first key in receso_notes
  const resolvedSlot = slotName || (serviceData?.receso_notes ? Object.keys(serviceData.receso_notes)[0] : null);
  if (!resolvedSlot) return null;
  const currentGlobalValue = serviceData?.receso_notes?.[resolvedSlot] || "";
  const setServiceData = useContext(UpdatersContext)?.setServiceData;
  const pushFn = useContext(UpdatersContext)?.pushFn;
  const [localValue, setLocalValue] = useState("");

  const commitNow = useDebouncedCommit(
    localValue,
    currentGlobalValue,
    (val) => {
      setServiceData(prev => ({
        ...prev,
        receso_notes: {
          ...prev.receso_notes,
          [resolvedSlot]: val
        }
      }));
      // Per-field push: receso_notes → Service entity
      if (pushFn) {
        pushFn("serviceField", { field: "receso_notes", slotName: resolvedSlot, value: val });
      }
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