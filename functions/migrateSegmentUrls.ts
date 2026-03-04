import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * migrateSegmentUrls.js
 * 
 * Data migration script to safely convert old comma-separated strings 
 * in Segment and SpeakerSubmissionVersion entities to Array of Strings,
 * reflecting the schema upgrade to strictly typed arrays.
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Ensure admin
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const URL_FIELDS = [
            'presentation_url', 'notes_url', 'video_url', 
            'dance_song_source', 'dance_song_2_url', 'dance_song_3_url',
            'drama_song_source', 'drama_song_2_url', 'drama_song_3_url',
            'arts_run_of_show_url',
            'spoken_word_music_url', 'spoken_word_script_url', 'spoken_word_audio_url'
        ];

        let migratedSegments = 0;
        let migratedVersions = 0;

        // Migrate Segments
        const segments = await base44.asServiceRole.entities.Segment.filter({});
        for (const segment of segments) {
            const updates = {};
            let needsUpdate = false;

            for (const field of URL_FIELDS) {
                if (segment[field] !== undefined && segment[field] !== null && typeof segment[field] === 'string') {
                    updates[field] = segment[field] ? segment[field].split(',').map(s => s.trim()).filter(Boolean) : [];
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await base44.asServiceRole.entities.Segment.update(segment.id, updates);
                migratedSegments++;
            }
        }

        // Migrate SpeakerSubmissionVersion
        const versions = await base44.asServiceRole.entities.SpeakerSubmissionVersion.filter({});
        for (const version of versions) {
            const updates = {};
            let needsUpdate = false;

            if (version.presentation_url !== undefined && version.presentation_url !== null && typeof version.presentation_url === 'string') {
                updates.presentation_url = version.presentation_url ? version.presentation_url.split(',').map(s => s.trim()).filter(Boolean) : [];
                needsUpdate = true;
            }
            if (version.notes_url !== undefined && version.notes_url !== null && typeof version.notes_url === 'string') {
                updates.notes_url = version.notes_url ? version.notes_url.split(',').map(s => s.trim()).filter(Boolean) : [];
                needsUpdate = true;
            }

            if (needsUpdate) {
                await base44.asServiceRole.entities.SpeakerSubmissionVersion.update(version.id, updates);
                migratedVersions++;
            }
        }

        return Response.json({ 
            success: true, 
            migratedSegments, 
            migratedVersions 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});