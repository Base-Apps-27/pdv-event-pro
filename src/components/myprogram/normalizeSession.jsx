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
    return {
      ...seg,
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

      result.push({
        id: seg.id || `${slotLabel}-${idx}`,
        title: seg.title || seg.data?.title || 'Untitled',
        segment_type: seg.type || seg.segment_type || seg.data?.type || 'Especial',
        start_time: startTime,
        end_time: endTime,
        duration_min: duration,
        presenter: seg.data?.presenter || seg.presenter || '',
        description_details: seg.data?.description || seg.description_details || '',
        projection_notes: seg.data?.projection_notes || seg.projection_notes || '',
        sound_notes: seg.data?.sound_notes || seg.sound_notes || '',
        ushers_notes: seg.data?.ushers_notes || seg.ushers_notes || '',
        translation_notes: seg.data?.translation_notes || seg.translation_notes || '',
        stage_decor_notes: seg.data?.stage_decor_notes || seg.stage_decor_notes || '',
        other_notes: seg.data?.other_notes || seg.other_notes || '',
        prep_instructions: seg.data?.prep_instructions || seg.prep_instructions || '',
        microphone_assignments: seg.data?.microphone_assignments || seg.microphone_assignments || '',
        segment_actions: seg.actions || seg.segment_actions || [],
        songs: seg.songs || [],
        has_video: seg.has_video || false,
        video_name: seg.video_name || seg.data?.video_name || '',
        video_url: seg.video_url || seg.data?.video_url || '',
        requires_translation: seg.requires_translation || false,
        translator_name: seg.data?.translator || seg.translator_name || '',
        translation_mode: seg.data?.translation_mode || seg.translation_mode || '',
        parsed_verse_data: seg.parsed_verse_data || seg.data?.parsed_verse_data || null,
        scripture_references: seg.scripture_references || seg.data?.scripture_references || '',
        message_title: seg.data?.message_title || seg.message_title || '',
        major_break: seg.major_break || false,
        sub_assignments: seg.sub_assignments || [],
        // data object passthrough for getSegmentData compatibility
        data: seg.data || {},
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