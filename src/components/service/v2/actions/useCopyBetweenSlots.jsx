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
import { base44 } from "@/api/base44Client";
import { TEAM_FIELDS, TEXT_COPY_COLUMNS } from "../constants/fieldMap";

/**
 * findMatchingSegment — finds the best-matching segment in the target array.
 * DECISION (2026-02-26): Match by segment_type + title instead of array index.
 * Index-based matching breaks when an admin inserts/removes a special segment
 * in one session, offsetting all subsequent segments.
 *
 * Strategy: segment_type + title (exact), then segment_type-only (first unused).
 */
function findMatchingSegment(sourceSeg, targetSegs, usedTargetIds) {
  // 1. Exact match: same segment_type AND same title
  const exactMatch = targetSegs.find(t =>
    !usedTargetIds.has(t.id) &&
    t.segment_type === sourceSeg.segment_type &&
    t.title === sourceSeg.title
  );
  if (exactMatch) {
    usedTargetIds.add(exactMatch.id);
    return exactMatch;
  }

  // 2. Type-only match: same segment_type, first unused
  const typeMatch = targetSegs.find(t =>
    !usedTargetIds.has(t.id) &&
    t.segment_type === sourceSeg.segment_type
  );
  if (typeMatch) {
    usedTargetIds.add(typeMatch.id);
    return typeMatch;
  }

  return null;
}

export function useCopyBetweenSlots(segmentsBySession, sessions, psdBySession, writeSegment, writeSession, writePSD, writeSongs, childSegments) {

  /**
   * copySegmentContent — copies one segment's content to the matching segment in the next slot.
   * BUGFIX (2026-02-26): Also copies child segment (sub-assignment) presenters.
   * BUGFIX (2026-02-26): Uses type+title matching instead of array index to survive
   * admin insertions/deletions of special segments.
   */
  const copySegmentContent = useCallback(async (sourceSessionId, segmentIndex) => {
    const sourceSegments = segmentsBySession[sourceSessionId] || [];
    const sourceSeg = sourceSegments[segmentIndex];
    if (!sourceSeg) return;

    // Find next session
    const srcIdx = sessions.findIndex(s => s.id === sourceSessionId);
    const targetSession = sessions[srcIdx + 1];
    if (!targetSession) return;

    const targetSegments = segmentsBySession[targetSession.id] || [];
    const usedIds = new Set();
    const targetSeg = findMatchingSegment(sourceSeg, targetSegments, usedIds);
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

    // 2026-04-15: Copy songs via SegmentSong entity (replaces flat-field writeSongs)
    try {
      const srcSongs = await base44.entities.SegmentSong.filter({ segment_id: sourceSeg.id }, 'order');
      if (srcSongs.length > 0) {
        // Delete existing target songs first
        const tgtSongs = await base44.entities.SegmentSong.filter({ segment_id: targetSeg.id });
        await Promise.all(tgtSongs.map(s => base44.entities.SegmentSong.delete(s.id)));
        // Create copies
        await base44.entities.SegmentSong.bulkCreate(
          srcSongs.map((s, i) => ({ segment_id: targetSeg.id, order: i + 1, title: s.title, lead: s.lead || '', key: s.key || '' }))
        );
        fieldsCopied += srcSongs.length;
      }
    } catch (songCopyErr) {
      console.warn('[useCopyBetweenSlots] Song copy failed:', songCopyErr.message);
    }

    // BUGFIX (2026-02-26): Copy sub-assignment (child segment) presenters for single copy too
    if (childSegments) {
      const srcChildren = childSegments[sourceSeg.id] || [];
      const tgtChildren = childSegments[targetSeg.id] || [];
      srcChildren.forEach((srcChild) => {
        if (!srcChild.presenter) return;
        const matchingTarget = tgtChildren.find(tc => tc.title === srcChild.title);
        if (matchingTarget) {
          writeSegment(matchingTarget.id, 'presenter', srcChild.presenter);
          fieldsCopied++;
        }
      });
    }

    toast.success(`Copiado (${fieldsCopied} campos)`);
  }, [segmentsBySession, sessions, writeSegment, childSegments]);

  const copyAllToSlot = useCallback(async (sourceSessionId, targetSessionId) => {
    const sourceSegs = segmentsBySession[sourceSessionId] || [];
    const targetSegs = segmentsBySession[targetSessionId] || [];
    let totalCopied = 0;

    // DECISION (2026-02-26): Use type+title matching instead of index.
    // Build a used-set so each target is matched at most once.
    const usedTargetIds = new Set();

    // Copy segments
    sourceSegs.forEach((src) => {
      const tgt = findMatchingSegment(src, targetSegs, usedTargetIds);
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

      // 2026-04-15: Songs copied via SegmentSong entity in bulk after loop
    });

    // BUGFIX (2026-02-26): Copy sub-assignment (child segment) presenters.
    // Uses the same type+title matching to pair parent segments, then title-matches children.
    if (childSegments) {
      const usedForChildren = new Set();
      sourceSegs.forEach((src) => {
        const tgt = findMatchingSegment(src, targetSegs, usedForChildren);
        if (!tgt) return;
        const srcChildren = childSegments[src.id] || [];
        const tgtChildren = childSegments[tgt.id] || [];
        srcChildren.forEach((srcChild) => {
          if (!srcChild.presenter) return;
          const matchingTarget = tgtChildren.find(tc => tc.title === srcChild.title);
          if (matchingTarget) {
            writeSegment(matchingTarget.id, 'presenter', srcChild.presenter);
            totalCopied++;
          }
        });
      });
    }

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

    // 2026-04-15: Batch copy songs for all matched segments
    try {
      const usedForSongs = new Set();
      for (const src of sourceSegs) {
        const tgt = findMatchingSegment(src, targetSegs, usedForSongs);
        if (!tgt) continue;
        const srcSongs = await base44.entities.SegmentSong.filter({ segment_id: src.id }, 'order');
        if (srcSongs.length === 0) continue;
        const tgtSongs = await base44.entities.SegmentSong.filter({ segment_id: tgt.id });
        await Promise.all(tgtSongs.map(s => base44.entities.SegmentSong.delete(s.id)));
        await base44.entities.SegmentSong.bulkCreate(
          srcSongs.map((s, i) => ({ segment_id: tgt.id, order: i + 1, title: s.title, lead: s.lead || '', key: s.key || '' }))
        );
        totalCopied += srcSongs.length;
      }
    } catch (songErr) {
      console.warn('[useCopyBetweenSlots] Bulk song copy failed:', songErr.message);
    }

    toast.success(`Todo copiado (${totalCopied} campos)`);
  }, [segmentsBySession, sessions, psdBySession, writeSegment, writeSession, writePSD, childSegments]);

  return { copySegmentContent, copyAllToSlot };
}