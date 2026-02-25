import React, { useContext, createContext } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { getSegmentData } from "@/components/utils/segmentDataUtils";

/**
 * WeeklyServiceInputs — Extracted from WeeklyServiceManager (Phase 3A).
 *
 * Entity Separation (2026-02-23): Each input now fires BOTH:
 *   1. setServiceData (optimistic local state — instant UI)
 *   2. Entity mutation via useSegmentMutation (300ms debounced DB write)
 *
 * The entity mutation is accessed via UpdatersContext, which now includes:
 *   - mutateSegmentField, mutateSongs, mutateTeam, mutatePreServiceNotes,
 *     mutateRecesoNotes, mutateSubAssignment
 *
 * If the mutation function is not available (e.g., during transition or if
 * _entityId is missing), the input silently falls back to blob-only mode.
 *
 * Exports:
 *   ServiceDataContext, UpdatersContext — React contexts for state sharing
 *   SongInputRow, PreServiceNotesInput, RecesoNotesInput, TeamInput,
 *   SegmentTextInput, SegmentTextarea, SegmentAutocomplete
 */

// Contexts for sharing serviceData and updaters
export const ServiceDataContext = createContext(null);
export const UpdatersContext = createContext(null);

// Song Input Row - direct state updates + entity mutation
export function SongInputRow({ service, segmentIndex, songIndex }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const song = segment?.songs?.[songIndex] || { title: "", lead: "", key: "" };
  const { updateSegmentField, mutateSongs } = useContext(UpdatersContext);

  const handleSongChange = (field, value) => {
    const songs = segment?.songs || [];
    const updated = [...songs];
    updated[songIndex] = { ...updated[songIndex], [field]: value };
    updateSegmentField(service, segmentIndex, "songs", updated);
    // Entity write: debounced song update
    if (mutateSongs && segment?._entityId) {
      mutateSongs(segment._entityId, updated);
    }
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

// Pre-Service Notes Input - direct state updates + entity mutation
export function PreServiceNotesInput({ service }) {
  const serviceData = useContext(ServiceDataContext);
  const notes = serviceData?.pre_service_notes?.[service] || "";
  const { setServiceData, mutatePreServiceNotes } = useContext(UpdatersContext);

  const handleChange = (val) => {
    setServiceData(prev => ({
      ...prev,
      pre_service_notes: {
        ...prev.pre_service_notes,
        [service]: val
      }
    }));
    // Entity write: debounced pre-service notes update
    const sessionId = serviceData?._sessionIds?.[service];
    if (mutatePreServiceNotes && sessionId) {
      mutatePreServiceNotes(sessionId, val);
    }
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

// Receso Notes Input - direct state updates + entity mutation
export function RecesoNotesInput({ slotName }) {
  const serviceData = useContext(ServiceDataContext);
  const resolvedSlot = slotName || (serviceData?.receso_notes ? Object.keys(serviceData.receso_notes)[0] : null);
  if (!resolvedSlot) return null;
  const notes = serviceData?.receso_notes?.[resolvedSlot] || "";
  const { setServiceData, mutateRecesoNotes } = useContext(UpdatersContext);

  const handleChange = (val) => {
    const updatedReceso = { ...serviceData?.receso_notes, [resolvedSlot]: val };
    setServiceData(prev => ({
      ...prev,
      receso_notes: {
        ...prev.receso_notes,
        [resolvedSlot]: val
      }
    }));
    // Entity write: debounced receso notes update (stored on Service entity)
    if (mutateRecesoNotes && serviceData?.id) {
      mutateRecesoNotes(serviceData.id, updatedReceso);
    }
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

// Team Input Component - direct state updates + entity mutation
export function TeamInput({ field, service, placeholder }) {
  const serviceData = useContext(ServiceDataContext);
  const value = serviceData?.[field]?.[service] || "";
  const { updateTeamField, mutateTeam } = useContext(UpdatersContext);

  const handleChange = (e) => {
    const val = e.target.value;
    updateTeamField(field, service, val);
    // Entity write: debounced team field update
    const sessionId = serviceData?._sessionIds?.[service];
    if (mutateTeam && sessionId) {
      mutateTeam(sessionId, field, val);
    }
  };

  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      className="text-xs"
    />
  );
}

// Segment Field Component - direct state updates + entity mutation
export function SegmentTextInput({ service, segmentIndex, field, placeholder, className = "text-sm" }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const value = getSegmentData(segment, field) || "";
  const { updateSegmentField, mutateSegmentField } = useContext(UpdatersContext);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value, service, segmentIndex, field]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    updateSegmentField(service, segmentIndex, field, val);
    // Entity write: debounced field update
    if (mutateSegmentField && segment?._entityId) {
      mutateSegmentField(segment._entityId, field, val);
    }
  };

  return (
    <Input
      placeholder={placeholder}
      value={inputValue}
      onChange={handleChange}
      className={className}
    />
  );
}

// Segment Textarea Component - direct state updates + entity mutation
export function SegmentTextarea({ service, segmentIndex, field, placeholder, className = "text-sm", rows = 2 }) {
  const segment = useContext(ServiceDataContext)?.[service]?.[segmentIndex];
  const value = getSegmentData(segment, field) || "";
  const { updateSegmentField, mutateSegmentField } = useContext(UpdatersContext);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value, service, segmentIndex, field]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    updateSegmentField(service, segmentIndex, field, val);
    // Entity write: debounced field update
    if (mutateSegmentField && segment?._entityId) {
      mutateSegmentField(segment._entityId, field, val);
    }
  };

  return (
    <Textarea
      placeholder={placeholder}
      value={inputValue}
      onChange={handleChange}
      className={className}
      rows={rows}
    />
  );
}

// Segment Autocomplete Component - direct state updates + entity mutation
export function SegmentAutocomplete({ service, segmentIndex, field, placeholder, type, className = "text-sm" }) {
  const serviceData = useContext(ServiceDataContext);
  const segment = serviceData?.[service]?.[segmentIndex];
  const value = getSegmentData(segment, field) || "";
  const { updateSegmentField, mutateSegmentField, mutateSubAssignment } = useContext(UpdatersContext);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value, service, segmentIndex, field]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    updateSegmentField(service, segmentIndex, field, val);

    if (!segment?._entityId) return;

    // Check if this field is a sub-assignment person field
    const subAssignments = segment.sub_assignments || [];
    const subIdx = subAssignments.findIndex(sa => sa.person_field_name === field);

    if (subIdx >= 0 && mutateSubAssignment) {
      // Sub-assignment field → write to child Ministración entity
      mutateSubAssignment(
        segment._entityId,
        segment._sessionId,
        serviceData?.id,
        subIdx,
        subAssignments[subIdx],
        val
      );
    } else if (mutateSegmentField) {
      // Regular segment field → write to Segment entity
      mutateSegmentField(segment._entityId, field, val);
    }
  };

  return (
    <AutocompleteInput
      type={type}
      placeholder={placeholder}
      value={inputValue}
      onChange={handleChange}
      className={className}
    />
  );
}