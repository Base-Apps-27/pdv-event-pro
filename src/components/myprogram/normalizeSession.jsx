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
 * Services embed segments in arrays: '9:30am', '11:30am', or 'segments'.
 * 
 * @param {Object} serviceData - The raw service object
 * @returns {Array} Normalized segments
 */
export function normalizeServiceSegments(serviceData) {
  if (!serviceData) return [];

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
        // Recalculate end
        const d2 = new Date();
        d2.setHours(h, m + duration, 0, 0);
        currentH = d2.getHours();
        currentM = d2.getMinutes();
      }

      // Resolve translation mode: explicit value wins, then slot-level default.
      // 11:30am service translation is always InPerson (on-stage);
      // 9:30am defaults to RemoteBooth when unspecified.
      const rawTransMode = seg.data?.translation_mode || seg.translation_mode || '';
      const resolvedTransMode = rawTransMode
        || (slotLabel === '11:30am' ? 'InPerson' : 'RemoteBooth');

      // Service segments store content fields with different keys than Event Segments:
      //   preacher  → data.preacher  (Events use "presenter" for Plenaria)
      //   title     → data.title     (message title, NOT the segment block title)
      //   leader    → data.leader    (worship leader)
      // We must map these carefully so MyProgram cards render them.
      const segData = seg.data || {};

      // Presenter: services use data.presenter OR data.preacher for Plenaria
      const presenter = segData.presenter || seg.presenter
        || segData.preacher || seg.preacher || '';

      // Message title: weekly services store it as data.title or data.messageTitle
      // Custom services may use seg.messageTitle or seg.message_title
      // IMPORTANT: data.title is the *message* title, NOT the block title (that's seg.title)
      const messageTitle = segData.messageTitle || segData.title
        || seg.messageTitle || segData.message_title || seg.message_title || '';

      // Leader (worship): data.leader
      const leader = segData.leader || seg.leader || '';

      result.push({
        id: seg.id || `${slotLabel}-${idx}`,
        title: seg.title || 'Untitled', // Block title lives at root only
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
        sub_assignments: seg.sub_assignments || [],
        breakout_rooms: seg.breakout_rooms || segData.breakout_rooms || [],
        // Presentation / notes URLs
        presentation_url: seg.presentation_url || segData.presentation_url || '',
        notes_url: seg.notes_url || segData.notes_url || '',
        content_is_slides_only: seg.content_is_slides_only || segData.content_is_slides_only || false,
        // Sub-assignment fields passthrough
        show_in_livestream: seg.show_in_livestream !== undefined ? seg.show_in_livestream : true,
        // data object passthrough for getSegmentData compatibility
        data: segData,
        _slotLabel: slotLabel,
        _sessionName: slotLabel,
        _sessionDate: serviceData.date || '',
        _sessionId: slotLabel,
        _source: 'service',
        order: idx,
      });
    });
  };

  // Weekly services
  if (serviceData['9:30am']) {
    processSlot(serviceData['9:30am'], '9:30am', '09:30');
  }
  if (serviceData['11:30am']) {
    processSlot(serviceData['11:30am'], '11:30am', '11:30');
  }
  // Custom services
  if (serviceData.segments && serviceData.segments.length > 0) {
    processSlot(serviceData.segments, 'custom', serviceData.time || '10:00');
  }

  return result;
}

/**
 * Get unique session labels from normalized segments.
 * @param {Array} segments - Normalized segments
 * @returns {Array} Unique session labels [{id, name}]
 */
export function getSessionLabels(segments) {
  const seen = new Set();
  const labels = [];
  segments.forEach(seg => {
    const id = seg._sessionId;
    if (id && !seen.has(id)) {
      seen.add(id);
      labels.push({ id, name: seg._sessionName || id });
    }
  });
  return labels;
}