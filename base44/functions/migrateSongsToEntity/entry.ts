/**
 * migrateSongsToEntity.js — One-time migration: copies flat song fields
 * from Segment (song_1_title..song_10_key) into SegmentSong entity records.
 *
 * 2026-04-15: Created as part of SegmentSong entity extraction.
 * Run as admin action: POST /migrateSongsToEntity
 *
 * SAFETY:
 * - Read-only on Segment — does NOT modify or remove old flat fields.
 * - Idempotent: skips segments that already have SegmentSong records.
 * - Logs every created record for traceability.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all segments (paginated)
    let allSegments = [];
    let skip = 0;
    const BATCH = 50;
    while (true) {
      const batch = await base44.asServiceRole.entities.Segment.list(undefined, BATCH, skip);
      allSegments = allSegments.concat(batch);
      if (batch.length < BATCH) break;
      skip += BATCH;
    }

    console.log(`[migrateSongsToEntity] Found ${allSegments.length} total segments`);

    // Filter to segments with at least one song
    const withSongs = allSegments.filter(seg => {
      for (let i = 1; i <= 10; i++) {
        if (seg[`song_${i}_title`]) return true;
      }
      return false;
    });

    console.log(`[migrateSongsToEntity] ${withSongs.length} segments have song data`);

    // Check which segments already have SegmentSong records (skip them)
    const segmentIds = withSongs.map(s => s.id);
    let existingSongs = [];
    for (let i = 0; i < segmentIds.length; i += 50) {
      const chunk = segmentIds.slice(i, i + 50);
      const found = await base44.asServiceRole.entities.SegmentSong.filter({
        segment_id: { $in: chunk }
      });
      existingSongs = existingSongs.concat(found);
    }

    const alreadyMigrated = new Set(existingSongs.map(s => s.segment_id));
    const toMigrate = withSongs.filter(s => !alreadyMigrated.has(s.id));

    console.log(`[migrateSongsToEntity] ${alreadyMigrated.size} already migrated, ${toMigrate.length} to migrate`);

    let created = 0;
    let errors = 0;

    for (const seg of toMigrate) {
      const songsToCreate = [];
      for (let i = 1; i <= 10; i++) {
        const title = seg[`song_${i}_title`];
        if (title && title.trim()) {
          songsToCreate.push({
            segment_id: seg.id,
            order: i,
            title: title.trim(),
            lead: (seg[`song_${i}_lead`] || '').trim(),
            key: (seg[`song_${i}_key`] || '').trim(),
          });
        }
      }

      if (songsToCreate.length === 0) continue;

      try {
        await base44.asServiceRole.entities.SegmentSong.bulkCreate(songsToCreate);
        created += songsToCreate.length;
        console.log(`[migrateSongsToEntity] Segment ${seg.id}: created ${songsToCreate.length} songs`);
      } catch (err) {
        errors++;
        console.error(`[migrateSongsToEntity] Failed for segment ${seg.id}:`, err.message);
      }
    }

    const summary = {
      totalSegments: allSegments.length,
      segmentsWithSongs: withSongs.length,
      alreadyMigrated: alreadyMigrated.size,
      segmentsMigrated: toMigrate.length,
      songsCreated: created,
      errors,
    };
    console.log('[migrateSongsToEntity] Summary:', JSON.stringify(summary));

    return Response.json(summary);
  } catch (error) {
    console.error('[migrateSongsToEntity] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});