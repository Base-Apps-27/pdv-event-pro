/**
 * normalizeSession — MyProgram Step 3
 * 
 * Normalization layer: maps Event segments + Service segments → unified model.
 * Both event-based (Session + Segment entities) and service-based (embedded arrays)
 * are transformed into a flat list of normalized segment objects.
 * 
 * Decision: "MyProgram: context-aware for Events vs Services with normalization layer"
 */

/**
 * Normalize segments from event program data.
 * Event segments are already individual Segment entities with full fields.
 * 
 * @param {Object} programData - from getPublicProgramData
 * @returns {Array} Normalized segments with session metadata
 */
export function normalizeEventSegments(programData) {
  if (!programData) return [];

  const sessions = programData.sessions || [];
  const segments = programData.segments || [];
  const rooms = programData.rooms || [];

  const sessionMap = {};
  sessions.forEach(s => { sessionMap[s.id] = s; });
  const roomMap = {};
  rooms.forEach(r => { roomMap[r.id] = r; });

  return segments.map(seg => {
    const session = sessionMap[seg.session_id] || {};
    // Enrich breakout rooms with room names if available
    const enrichedBreakouts = (seg.breakout_rooms || []).map(br => ({
      ...br,
      _roomName: br.room_id ? (roomMap[br.room_id]?.name || '') : ''
    }));

    return {
      ...seg,
      breakout_rooms: enrichedBreakouts,
      // Augment with session metadata
      _sessionName: session.name || '',
      _sessionDate: session.date || '',
      _sessionId: session.id || '',
      _roomName: seg.room_id ? (roomMap[seg.room_id]?.name || '') : '',
      _source: 'event',
    };
  }).sort((a, b) => {
    // Sort by session order, then segment order
    const sessionA = sessionMap[a.session_id];
    const sessionB = sessionMap[b.session_id];
    const sOrdA = sessionA?.order ?? 0;
    const sOrdB = sessionB?.order ?? 0;
    if (sOrdA !== sOrdB) return sOrdA - sOrdB;
    return (a.order || 0) - (b.order || 0);
  });
}

/**
 * Normalize segments from service program data.
 *
 * Supports two data paths:
 *   1. Entity-sourced: programData has sessions[] + segments[] (Session/Segment entities)
 *   2. JSON-sourced (legacy): serviceData has '9:30am'[], '11:30am'[], or 'segments'[]
 *
 * @param {Object} serviceData - The raw service/program object
 * @returns {Array} Normalized segments
 */
export function normalizeServiceSegments(serviceData) {
  if (!serviceData) return [];

  // ── Entity-first path: sessions + segments from backend ──
  // When getPublicProgramData returns entity-sourced data, programData.sessions
  // and programData.segments are real Session/Segment entities.
  if (serviceData.sessions && serviceData.sessions.length > 0 &&
      serviceData.segments && serviceData.segments.length > 0) {
    return normalizeEntitySourcedSegments(serviceData);
  }

  // ── JSON fallback: read from embedded arrays ──
  // If serviceData has a .program sub-object (cache snapshot shape), extract the
  // raw Service entity for JSON discovery. Otherwise, serviceData IS the service.
  const program = serviceData.program || serviceData;
  return normalizeJsonSourcedSegments(program);
}

/**
 * Entity-sourced normalization: sessions and segments are real entities.
 * Segment entities already have start_time, end_time, duration_min, etc.
 */
function normalizeEntitySourcedSegments(programData) {
  const sessions = programData.sessions || [];
  const segments = programData.segments || [];
  const serviceDate = programData.program?.date || programData.date || '';

  const sessionMap = {};
  sessions.forEach(s => { sessionMap[s.id] = s; });

  return segments
    .filter(seg => seg.show_in_general !== false)
    .map(seg => {
      const session = sessionMap[seg.session_id] || {};
      const slotLabel = session.name || 'custom';

      // Resolve translation mode — entity segments should carry explicit mode;
      // fallback to 'RemoteBooth' (safe default) if not set.
      const rawTransMode = seg.translation_mode || '';
      const resolvedTransMode = rawTransMode || 'RemoteBooth';

      return {
        id: seg.id,
        title: seg.title || 'Untitled',
        segment_type: seg.segment_type || 'Especial',
        start_time: seg.start_time || null,
        end_time: seg.end_time || null,
        duration_min: seg.duration_min || 0,
        presenter: seg.presenter || '',
        leader: seg.presenter || '', // Entity segments unify to presenter
        description_details: seg.description_details || seg.description || '',
        projection_notes: seg.projection_notes || '',
        sound_notes: seg.sound_notes || '',
        ushers_notes: seg.ushers_notes || '',
        translation_notes: seg.translation_notes || '',
        stage_decor_notes: seg.stage_decor_notes || '',
        livestream_notes: seg.livestream_notes || '',
        other_notes: seg.other_notes || '',
        coordinator_notes: seg.coordinator_notes || '',
        prep_instructions: seg.prep_instructions || '',
        microphone_assignments: seg.microphone_assignments || '',
        segment_actions: seg.segment_actions || [],
        songs: seg.songs || [],
        has_video: seg.has_video || false,
        video_name: seg.video_name || '',
        video_url: seg.video_url || '',
        requires_translation: seg.requires_translation || false,
        translator_name: seg.translator_name || '',
        translation_mode: resolvedTransMode,
        parsed_verse_data: seg.parsed_verse_data || null,
        scripture_references: seg.scripture_references || '',
        message_title: seg.message_title || '',
        major_break: seg.major_break || false,
        sub_assignments: seg.sub_assignments || [],
        breakout_rooms: seg.breakout_rooms || [],
        presentation_url: seg.presentation_url || '',
        notes_url: seg.notes_url || '',
        content_is_slides_only: seg.content_is_slides_only || false,
        show_in_livestream: seg.show_in_livestream !== undefined ? seg.show_in_livestream : true,
        submitted_content: seg.submitted_content || '',
        submission_status: seg.submission_status || '',
        // Enriched data object for getSegmentData compatibility
        data: {
          presenter: seg.presenter || '',
          preacher: seg.presenter || '',
          leader: seg.presenter || '',
          message_title: seg.message_title || '',
          messageTitle: seg.message_title || '',
          translator: seg.translator_name || '',
        },
        _slotLabel: slotLabel,
        _sessionName: slotLabel,
        _sessionDate: session.date || serviceDate,
        _sessionId: session.id || slotLabel,
        _source: 'service',
        order: seg.order || 0,
      };
    })
    .sort((a, b) => {
      // Sort by session order, then segment order
      const sA = sessionMap[a._sessionId];
      const sB = sessionMap[b._sessionId];
      const sOrdA = sA?.order ?? 0;
      const sOrdB = sB?.order ?? 0;
      if (sOrdA !== sOrdB) return sOrdA - sOrdB;
      return (a.order || 0) - (b.order || 0);
    });
}

/**
 * JSON-sourced normalization (legacy): reads from '9:30am'[], '11:30am'[], 'segments'[].
 */
function normalizeJsonSourcedSegments(serviceData) {
  const result = [];

  const processSlot = (segments, slotLabel, baseTime) => {
    if (!segments || !Array.isArray(segments)) return;

    let currentH = 0, currentM = 0;
    if (baseTime) {
      [currentH, currentM] = baseTime.split(':').map(Number);
    }

    segments.forEach((seg, idx) => {
      // Calculate start_time if missing
      let startTime = seg.start_time || seg.data?.start_time;
      if (!startTime && baseTime) {
        startTime = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
      }

      const duration = seg.duration || seg.duration_min || 0;
      const d = new Date();
      d.setHours(currentH, currentM + duration, 0, 0);
      currentH = d.getHours();
      currentM = d.getMinutes();

      const endTime = seg.end_time || seg.data?.end_time ||
        `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;

      // Update pointer if segment has explicit start
      if (seg.start_time) {
        const [h, m] = seg.start_time.split(':').map(Number);
        currentH = h; currentM = m;
        const d2 = new Date();
        d2.setHours(h, m + duration, 0, 0);
        currentH = d2.getHours();
        currentM = d2.getMinutes();
      }

      const rawTransMode = seg.data?.translation_mode || seg.translation_mode || '';
      const resolvedTransMode = rawTransMode || 'RemoteBooth';

      const segData = seg.data || {};
      const presenter = segData.presenter || seg.presenter
        || segData.preacher || seg.preacher || '';
      const messageTitle = segData.messageTitle || segData.title
        || seg.messageTitle || segData.message_title || seg.message_title || '';
      const leader = segData.leader || seg.leader || '';

      result.push({
        id: seg.id || `${slotLabel}-${idx}`,
        title: seg.title || 'Untitled',
        segment_type: seg.type || seg.segment_type || segData.type || 'Especial',
        start_time: startTime,
        end_time: endTime,
        duration_min: duration,
        presenter: presenter,
        leader: leader,
        description_details: segData.description_details || seg.description_details
          || segData.description || seg.description || '',
        projection_notes: segData.projection_notes || seg.projection_notes || '',
        sound_notes: segData.sound_notes || seg.sound_notes || '',
        ushers_notes: segData.ushers_notes || seg.ushers_notes || '',
        translation_notes: segData.translation_notes || seg.translation_notes || '',
        stage_decor_notes: segData.stage_decor_notes || seg.stage_decor_notes || '',
        livestream_notes: seg.livestream_notes || segData.livestream_notes || '',
        other_notes: segData.other_notes || seg.other_notes || '',
        coordinator_notes: segData.coordinator_notes || seg.coordinator_notes || '',
        prep_instructions: segData.prep_instructions || seg.prep_instructions || '',
        microphone_assignments: segData.microphone_assignments || seg.microphone_assignments || '',
        segment_actions: seg.actions || seg.segment_actions || [],
        songs: seg.songs || [],
        has_video: seg.has_video || false,
        video_name: seg.video_name || segData.video_name || '',
        video_url: seg.video_url || segData.video_url || '',
        requires_translation: seg.requires_translation || false,
        translator_name: segData.translator || seg.translator_name || '',
        translation_mode: resolvedTransMode,
        parsed_verse_data: seg.parsed_verse_data || segData.parsed_verse_data || null,
        scripture_references: seg.scripture_references || segData.scripture_references || '',
        message_title: messageTitle,
        major_break: seg.major_break || false,
        sub_assignments: (seg.sub_assignments || []).map(sa => ({
          ...sa,
          _resolvedPerson: sa.person_field_name
            ? (segData[sa.person_field_name] || seg[sa.person_field_name] || '')
            : '',
        })),
        breakout_rooms: seg.breakout_rooms || segData.breakout_rooms || [],
        presentation_url: seg.presentation_url || segData.presentation_url || '',
        notes_url: seg.notes_url || segData.notes_url || '',
        content_is_slides_only: seg.content_is_slides_only || segData.content_is_slides_only || false,
        show_in_livestream: seg.show_in_livestream !== undefined ? seg.show_in_livestream : true,
        data: {
          ...segData,
          presenter: presenter || segData.presenter || '',
          preacher: segData.preacher || presenter || '',
          leader: leader || segData.leader || '',
          message_title: messageTitle || '',
          messageTitle: messageTitle || '',
          translator: segData.translator || seg.translator_name || '',
        },
        _slotLabel: slotLabel,
        _sessionName: slotLabel,
        _sessionDate: serviceData.date || '',
        _sessionId: slotLabel,
        _source: 'service',
        order: idx,
      });
    });
  };

  // Weekly services (JSON path): Dynamic slot discovery instead of hardcoded keys.
  // Pattern: keys matching "9:30am", "11:30am", "7:00pm", etc.
  const slotKeys = Object.keys(serviceData)
    .filter(k => /^\d+:\d+[ap]m$/i.test(k) && Array.isArray(serviceData[k]) && serviceData[k].length > 0)
    .sort((a, b) => {
      const pa = a.match(/^(\d+):(\d+)(am|pm)$/i);
      const pb = b.match(/^(\d+):(\d+)(am|pm)$/i);
      if (!pa || !pb) return 0;
      let ha = parseInt(pa[1]); if (pa[3].toLowerCase() === 'pm' && ha < 12) ha += 12; if (pa[3].toLowerCase() === 'am' && ha === 12) ha = 0;
      let hb = parseInt(pb[1]); if (pb[3].toLowerCase() === 'pm' && hb < 12) hb += 12; if (pb[3].toLowerCase() === 'am' && hb === 12) hb = 0;
      return (ha * 60 + parseInt(pa[2])) - (hb * 60 + parseInt(pb[2]));
    });

  slotKeys.forEach(slotKey => {
    const match = slotKey.match(/^(\d+):(\d+)(am|pm)$/i);
    if (match) {
      let h = parseInt(match[1]);
      const m = match[2];
      const period = match[3].toLowerCase();
      if (period === 'pm' && h < 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      const baseTime = `${String(h).padStart(2, '0')}:${m}`;
      processSlot(serviceData[slotKey], slotKey, baseTime);
    }
  });

  // Custom / one-off services
  if (serviceData.segments && serviceData.segments.length > 0 && result.length === 0) {
    processSlot(serviceData.segments, 'custom', serviceData.time || '10:00');
  }

  return result;
}

/**
 * Auto-generate a short session label from date + start time.
 * E.g. "Viernes PM" → "Vie PM", "Sábado AM" → "Sáb AM"
 * Service slots (9:30am, 11:30am, custom) pass through as-is.
 */
function generateShortLabel(sessionName, sessionDate, startTime, language) {
  // Service slot names — already short (e.g. "9:30am", "6:00pm", "custom")
  if (sessionName === 'custom' || /^\d+:\d+[ap]m$/i.test(sessionName)) return sessionName;

  // If we have a date, build "Day AM/PM" from it
  if (sessionDate) {
    const dayNames = language === 'es'
      ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const [y, m, d] = sessionDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayAbbr = dayNames[dateObj.getDay()];

    // Determine AM/PM from start time
    let ampm = '';
    if (startTime) {
      const [h] = startTime.split(':').map(Number);
      ampm = h < 12 ? ' AM' : ' PM';
    }

    return `${dayAbbr}${ampm}`;
  }

  // Fallback: truncate the original name
  if (sessionName.length <= 12) return sessionName;
  return sessionName.substring(0, 10) + '…';
}

/**
 * Get unique session labels from normalized segments.
 * Returns [{id, name, shortLabel, date, endMinutes}]
 *
 * shortLabel: auto-abbreviated for pill display.
 * endMinutes: last segment end time (minutes from midnight) — used for past-dimming.
 * 
 * @param {Array} segments - Normalized segments
 * @param {string} language - 'en' | 'es'
 * @returns {Array} Unique session labels
 */
export function getSessionLabels(segments, language = 'es') {
  const seen = new Set();
  const sessionMap = {};

  segments.forEach(seg => {
    const id = seg._sessionId;
    if (!id) return;

    if (!seen.has(id)) {
      seen.add(id);
      sessionMap[id] = {
        id,
        name: seg._sessionName || id,
        date: seg._sessionDate || '',
        startTime: seg.start_time || '',
        endMinutes: 0,
      };
    }

    // Track latest end time across all segments in this session
    if (seg.end_time) {
      const [h, m] = seg.end_time.split(':').map(Number);
      const endMin = h * 60 + m;
      if (endMin > sessionMap[id].endMinutes) {
        sessionMap[id].endMinutes = endMin;
      }
    }
  });

  // Build final array preserving insertion order
  const labels = [];
  seen.forEach(id => {
    const s = sessionMap[id];
    labels.push({
      id: s.id,
      name: s.name,
      shortLabel: generateShortLabel(s.name, s.date, s.startTime, language),
      date: s.date,
      endMinutes: s.endMinutes,
    });
  });

  return labels;
}