/**
 * useCopyBetweenSlots.js — V2 copy content between slots.
 * Copies text fields from source segments to target segments via entity writes.
 * Also copies team fields and pre-service notes.
 */

import { useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { TEAM_FIELDS } from "../constants/fieldMap";

const TEXT_COLUMNS = [
  'presenter', 'message_title', 'scripture_references', 'translator_name',
  'description_details', 'coordinator_notes', 'projection_notes',
  'sound_notes', 'ushers_notes', 'translation_notes', 'stage_decor_notes',
];

export function useCopyBetweenSlots(segmentsBySession, sessions, psdBySession, writeSegment, writeSession, writePSD, writeSongs) {

  const copySegmentContent = useCallback(async (sourceSessionId, segmentIndex) => {
    const sourceSegments = segmentsBySession[sourceSessionId] || [];
    const sourceSeg = sourceSegments[segmentIndex];
    if (!sourceSeg) return;

    // Find next session
    const srcIdx = sessions.findIndex(s => s.id === sourceSessionId);
    const targetSession = sessions[srcIdx + 1];
    if (!targetSession) return;

    const targetSegments = segmentsBySession[targetSession.id] || [];
    const targetSeg = targetSegments[segmentIndex];
    if (!targetSeg) {
      toast.info("No hay segmento correspondiente en el siguiente horario");
      return;
    }

    // Copy text fields
    TEXT_COLUMNS.forEach(col => {
      if (sourceSeg[col]) {
        writeSegment(targetSeg.id, col, sourceSeg[col]);
      }
    });

    // Copy songs
    const songPayload = {};
    let hasSongs = false;
    for (let i = 1; i <= 6; i++) {
      if (sourceSeg[`song_${i}_title`]) {
        hasSongs = true;
        songPayload[`song_${i}_title`] = sourceSeg[`song_${i}_title`] || '';
        songPayload[`song_${i}_lead`] = sourceSeg[`song_${i}_lead`] || '';
        songPayload[`song_${i}_key`] = sourceSeg[`song_${i}_key`] || '';
      }
    }
    if (hasSongs) {
      const songs = [];
      for (let i = 1; i <= 6; i++) {
        if (sourceSeg[`song_${i}_title`]) {
          songs.push({ title: sourceSeg[`song_${i}_title`], lead: sourceSeg[`song_${i}_lead`] || '', key: sourceSeg[`song_${i}_key`] || '' });
        }
      }
      writeSongs(targetSeg.id, songs);
    }

    toast.success("Contenido copiado");
  }, [segmentsBySession, sessions, writeSegment, writeSongs]);

  const copyAllToSlot = useCallback(async (sourceSessionId, targetSessionId) => {
    const sourceSegs = segmentsBySession[sourceSessionId] || [];
    const targetSegs = segmentsBySession[targetSessionId] || [];

    // Copy segments
    sourceSegs.forEach((src, idx) => {
      const tgt = targetSegs[idx];
      if (!tgt) return;
      TEXT_COLUMNS.forEach(col => {
        if (src[col]) writeSegment(tgt.id, col, src[col]);
      });
      // Songs
      const songs = [];
      for (let i = 1; i <= 6; i++) {
        if (src[`song_${i}_title`]) {
          songs.push({ title: src[`song_${i}_title`], lead: src[`song_${i}_lead`] || '', key: src[`song_${i}_key`] || '' });
        }
      }
      if (songs.length > 0) writeSongs(tgt.id, songs);
    });

    // Copy team fields
    const srcSession = sessions.find(s => s.id === sourceSessionId);
    if (srcSession) {
      TEAM_FIELDS.forEach(f => {
        if (srcSession[f.column]) {
          writeSession(targetSessionId, f.column, srcSession[f.column]);
        }
      });
    }

    // Copy pre-service notes
    const srcPSD = psdBySession[sourceSessionId];
    if (srcPSD?.general_notes) {
      const tgtPSD = psdBySession[targetSessionId];
      writePSD(tgtPSD?.id || null, targetSessionId, 'general_notes', srcPSD.general_notes);
    }

    toast.success("Todo copiado al siguiente horario");
  }, [segmentsBySession, sessions, psdBySession, writeSegment, writeSession, writePSD, writeSongs]);

  return { copySegmentContent, copyAllToSlot };
}