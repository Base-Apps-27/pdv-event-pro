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
 * IMPORTANT: Services and Events store data differently:
 * - Weekly Services: Structural fields (title, type, duration) are at ROOT
 *   Content fields (preacher, leader, message_title) are in data object
 * - Events (Segment entity): Most fields at root, some in data
 * 
 * PRIORITY LOGIC:
 * - Structural fields (title, type, duration): Check ROOT first, then data
 * - Content fields: Check DATA first, then root
 * This prevents data.title (message title) from overwriting segment.title (block name)
 */
export const getSegmentData = (segment, field) => {
  if (!segment) return "";
  
  // Structural fields - these define the segment's identity, stored at root in weekly services
  const structuralFields = ['title', 'type', 'duration', 'start_time', 'end_time', 'order'];
  
  if (structuralFields.includes(field)) {
    // Check root first for structural fields
    if (segment[field] !== undefined && segment[field] !== null) {
      return segment[field];
    }
    // Fallback to data (for custom services that might store differently)
    if (segment.data && segment.data[field] !== undefined && segment.data[field] !== null) {
      return segment.data[field];
    }
    return "";
  }
  
  // Content fields - user-entered data, stored in data object for weekly services
  // Check data object first
  if (segment.data && segment.data[field] !== undefined && segment.data[field] !== null) {
    return segment.data[field];
  }
  
  // Fallback to root (Entity segments and some weekly service fields like translator_name)
  if (segment[field] !== undefined && segment[field] !== null) {
    return segment[field];
  }
  
  return "";
};

/**
 * Normalizes songs from various formats (array of objects or flat fields)
 * Returns array of { title, lead, key }
 */
export const getNormalizedSongs = (segment) => {
  if (!segment) return [];

  // 1. Check data.songs (Canonical)
  if (segment.data?.songs && Array.isArray(segment.data.songs) && segment.data.songs.length > 0) {
    return segment.data.songs;
  }

  // 2. Check root songs (Legacy Array)
  if (segment.songs && Array.isArray(segment.songs) && segment.songs.length > 0) {
    return segment.songs;
  }

  // 3. Check flat fields (Legacy or Entity format)
  // We check both data and root for flat fields
  const songs = [];
  const getField = (f) => segment.data?.[f] || segment[f];
  
  for (let i = 1; i <= 6; i++) {
    const title = getField(`song_${i}_title`);
    if (title) {
      songs.push({
        title,
        lead: getField(`song_${i}_lead`),
        key: getField(`song_${i}_key`)
      });
    }
  }
  
  return songs;
};