/**
 * useCopyBetweenSlots.js — V2 copy content between slots.
 * HARDENING (Phase 8):
 *   - Uses TEXT_COPY_COLUMNS from fieldMap (single source of truth)
 *   - Copies parsed_verse_data (structured data, not just text)
 *   - Copies submission_status for speaker workflow continuity
 *   - Clearer toast feedback with count
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { TEAM_FIELDS, TEXT_COPY_COLUMNS } from "../constants/fieldMap";

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

    let fieldsCopied = 0;

    // Copy text fields
    TEXT_COPY_COLUMNS.forEach(col => {
      if (sourceSeg[col] !== undefined && sourceSeg[col] !== null && sourceSeg[col] !== '') {
        writeSegment(targetSeg.id, col, sourceSeg[col]);
        fieldsCopied++;
      }
    });

    // Copy parsed verse data (structured object, not in TEXT_COPY_COLUMNS)
    if (sourceSeg.parsed_verse_data) {
      writeSegment(targetSeg.id, 'parsed_verse_data', sourceSeg.parsed_verse_data);
      fieldsCopied++;
    }

    // Copy songs
    const songs = [];
    for (let i = 1; i <= 6; i++) {
      if (sourceSeg[`song_${i}_title`]) {
        songs.push({
          title: sourceSeg[`song_${i}_title`],
          lead: sourceSeg[`song_${i}_lead`] || '',
          key: sourceSeg[`song_${i}_key`] || '',
        });
      }
    }
    if (songs.length > 0) {
      writeSongs(targetSeg.id, songs);
      fieldsCopied++;
    }

    toast.success(`Copiado (${fieldsCopied} campos)`);
  }, [segmentsBySession, sessions, writeSegment, writeSongs]);

  const copyAllToSlot = useCallback(async (sourceSessionId, targetSessionId) => {
    const sourceSegs = segmentsBySession[sourceSessionId] || [];
    const targetSegs = segmentsBySession[targetSessionId] || [];
    let totalCopied = 0;

    // Copy segments
    sourceSegs.forEach((src, idx) => {
      const tgt = targetSegs[idx];
      if (!tgt) return;

      TEXT_COPY_COLUMNS.forEach(col => {
        if (src[col] !== undefined && src[col] !== null && src[col] !== '') {
          writeSegment(tgt.id, col, src[col]);
          totalCopied++;
        }
      });

      if (src.parsed_verse_data) {
        writeSegment(tgt.id, 'parsed_verse_data', src.parsed_verse_data);
      }

      // Songs
      const songs = [];
      for (let i = 1; i <= 6; i++) {
        if (src[`song_${i}_title`]) {
          songs.push({
            title: src[`song_${i}_title`],
            lead: src[`song_${i}_lead`] || '',
            key: src[`song_${i}_key`] || '',
          });
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
          totalCopied++;
        }
      });
    }

    // Copy pre-service notes
    const srcPSD = psdBySession[sourceSessionId];
    if (srcPSD?.general_notes) {
      const tgtPSD = psdBySession[targetSessionId];
      writePSD(tgtPSD?.id || null, targetSessionId, 'general_notes', srcPSD.general_notes);
      totalCopied++;
    }

    toast.success(`Todo copiado (${totalCopied} campos)`);
  }, [segmentsBySession, sessions, psdBySession, writeSegment, writeSession, writePSD, writeSongs]);

  return { copySegmentContent, copyAllToSlot };
}