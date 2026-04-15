// Canonical Segment Data Structure Utilities
// Addresses the need for a consistent data model while preserving legacy data support

/**
 * Normalizes a raw segment object (from DB or legacy state) into the canonical structure.
 * 
 * Canonical Structure:
 * {
 *   title: string,
 *   type: string,
 *   duration: number,
 *   ...universal_fields,
 *   data: {
 *     leader: string,
 *     preacher: string,
 *     songs: [],
 *     notes: string,
 *     ...type_specific_fields
 *   }
 * }
 */
export const normalizeSegment = (rawSegment) => {
  if (!rawSegment) return null;

  // Clone to avoid mutation
  const seg = { ...rawSegment };

  // Ensure data object exists
  if (!seg.data) {
    seg.data = {};
  }

  // List of fields that should live in 'data' but might be at root in legacy data
  const dataFields = [
    'leader', 'preacher', 'presenter', 'translator',
    'messageTitle', 'verse', 'songs',
    'description', 'description_details',
    'coordinator_notes', 'projection_notes', 'sound_notes',
    'ushers_notes', 'translation_notes', 'stage_decor_notes',
    'actions', 'parsed_verse_data',
    'presentation_url', 'notes_url', 'content_is_slides_only'
  ];

  // Move legacy fields to data if they exist at root and NOT in data
  dataFields.forEach(field => {
    // If field exists at root (and isn't null/undefined)
    if (seg[field] !== undefined && seg[field] !== null) {
      // If it's missing in data, or if we want to prioritize root (legacy behavior often updated root)
      // We'll prioritize root value if it exists, then sync to data
      seg.data[field] = seg[field];
    } else if (seg.data[field] !== undefined) {
      // If root is missing but data has it, ensure root has it for backward compat
      // (This is controversial but safer for strict "preservation" during transition)
      // updated: actually, we want to migrate TO data. 
      // So we leave it in data. We might keep it in root for read-only legacy consumers,
      // but the app should primarily read from data.
    }
  });
  
  // Specific handling for songs (ensure array)
  if (!Array.isArray(seg.data.songs)) {
    seg.data.songs = [];
  }
  
  return seg;
};

/**
 * Normalizes service team fields to ensure they are objects { main: string }
 */
export const normalizeServiceTeams = (rawService) => {
  if (!rawService) return null;
  const srv = { ...rawService };

  const teamFields = ['coordinators', 'ujieres', 'sound', 'luces', 'fotografia'];
  
  teamFields.forEach(field => {
    const val = srv[field];
    if (typeof val === 'string') {
      srv[field] = { main: val };
    } else if (!val) {
      srv[field] = { main: "" };
    } else if (typeof val === 'object' && !val.main && val.main !== "") {
      // Handle edge case of empty object
      srv[field] = { main: "" };
    }
    // If it's already { main: "..." }, leave it
  });

  // Ensure segments are normalized too
  if (Array.isArray(srv.segments)) {
    srv.segments = srv.segments.map(normalizeSegment);
  }

  return srv;
};

/**
 * Accessor helper to safely get a value from a segment
 * 
 * NOTE (2026-02-24 Entity Lift Purge): Legacy `data` sub-object fallbacks
 * have been removed. All data is now securely at the root level of the Segment entity.
 */
export const getSegmentData = (segment, field) => {
  if (!segment) return "";
  // Person field aliases: "leader", "preacher", "presenter" all map to the same
  // entity column (presenter) and data key. Check both the requested field and
  // the canonical data.presenter / data.leader / data.preacher fallbacks.
  const PERSON_ALIASES = { leader: true, preacher: true, presenter: true };
  if (PERSON_ALIASES[field]) {
    // Check root level first, then data sub-object
    return segment.presenter || segment.data?.presenter
      || segment[field] || segment.data?.[field] || "";
  }
  if (segment[field] !== undefined && segment[field] !== null) {
    return segment[field];
  }
  // Fallback to data sub-object for hydrated weekly JSON format
  if (segment.data?.[field] !== undefined && segment.data?.[field] !== null) {
    return segment.data[field];
  }
  return "";
};

/**
 * Normalizes songs for a segment.
 * 2026-04-15: Now checks for attached _songs array (SegmentSong entities) first,
 * then falls back to flat fields (song_1_title..song_10_key) for backward compat.
 * Returns array of { title, lead, key }
 */
export const getNormalizedSongs = (segment) => {
  if (!segment) return [];

  // Prefer SegmentSong entities if attached by snapshot builder or data hook
  if (Array.isArray(segment._songs) && segment._songs.length > 0) {
    return segment._songs
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .filter(s => s.title)
      .map(s => ({ title: s.title, lead: s.lead || '', key: s.key || '' }));
  }

  // Fallback: flat fields on Segment entity (deprecated, backward compat)
  const songs = [];
  for (let i = 1; i <= 10; i++) {
    const title = segment[`song_${i}_title`];
    if (title) {
      songs.push({
        title,
        lead: segment[`song_${i}_lead`] || '',
        key: segment[`song_${i}_key`] || ''
      });
    }
  }
  
  return songs;
};