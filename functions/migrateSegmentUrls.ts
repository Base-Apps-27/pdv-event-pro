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
        
        // Helper to delay
        const delay = ms => new Promise(r => setTimeout(r, ms));

        // Migrate Segments
        // We might want to use pagination if there are too many, but .filter({}) maxes at 1000 typically
        const segments = await base44.asServiceRole.entities.Segment.filter({});
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
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
                if (migratedSegments % 10 === 0) await delay(100); // Prevent rate limit
            }
        }

        // Migrate SpeakerSubmissionVersion
        const versions = await base44.asServiceRole.entities.SpeakerSubmissionVersion.filter({});
        for (let i = 0; i < versions.length; i++) {
            const version = versions[i];
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
                if (migratedVersions % 10 === 0) await delay(100); // Prevent rate limit
            }
        }

        return Response.json({ 
            success: true, 
            migratedSegments, 
            migratedVersions 
        });

    } catch (error) {
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
});