import { normalizeSegment, getSegmentData, getNormalizedSongs } from "./segmentDataUtils";
import { format, parse, addMinutes } from "date-fns";
import { es } from "date-fns/locale";

const sanitizeHtml = (html) => {
  if (!html) return '';
  return html.replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '').replace(/&nbsp;/g, ' ').replace(/<br\s*\/?>/gi, '\n');
};

const estimateContentWeight = (segments, announcements) => {
  let page1Weight = 0;
  let page2Weight = 0;

  // Page 1: Service Program
  segments.forEach(seg => {
    page1Weight += 1.5; // segment header
    const songs = getNormalizedSongs(seg);
    page1Weight += songs.length * 0.8; // each song
    
    const notes = [
      getSegmentData(seg, 'description'),
      getSegmentData(seg, 'description_details'),
      getSegmentData(seg, 'coordinator_notes'),
      getSegmentData(seg, 'projection_notes'),
      getSegmentData(seg, 'sound_notes'),
      getSegmentData(seg, 'ushers_notes'),
      getSegmentData(seg, 'translation_notes'),
      getSegmentData(seg, 'stage_decor_notes')
    ].filter(n => n);
    
    notes.forEach(note => {
      page1Weight += Math.ceil((note || '').length / 90);
    });
  });

  // Page 2: Announcements
  announcements.fixed.forEach(ann => {
    page2Weight += 1.2; // header
    page2Weight += Math.ceil((ann.content || '').length / 90);
    if (ann.instructions) page2Weight += 0.5;
  });
  
  announcements.dynamic.forEach(ann => {
    page2Weight += 1.2;
    page2Weight += Math.ceil((ann.content || '').length / 90);
    if (ann.instructions) page2Weight += 0.5;
  });

  return { page1Weight, page2Weight };
};

const calculateScale = (weight, maxWeight, minScale = 0.72) => {
  if (weight <= maxWeight) return 1.0;
  const scale = maxWeight / weight;
  return Math.max(scale, minScale);
};

const truncateText = (text, maxChars) => {
  if (!text || text.length <= maxChars) return text;
  return text.substring(0, maxChars - 10) + '...(ver app)';
};

export function buildServicePrintModel(serviceData, allAnnouncements, settings = {}) {
  if (!serviceData) return null;

  // Normalize service data
  const segments = (serviceData.segments || []).map(normalizeSegment);
  
  // Calculate times
  let currentTime = serviceData.time ? parse(serviceData.time, 'HH:mm', new Date()) : null;
  const formattedSegments = segments.map(seg => {
    const startTimeStr = currentTime ? format(currentTime, 'h:mm a') : '';
    if (currentTime && seg.duration_min) {
      currentTime = addMinutes(currentTime, seg.duration_min);
    }

    const segmentType = seg.segment_type || seg.type || getSegmentData(seg, 'type') || 'Especial';
    const isWorship = ['Alabanza', 'worship'].includes(segmentType);
    const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
    
    const leader = isWorship ? getSegmentData(seg, 'leader') : null;
    const preacher = isMessage ? getSegmentData(seg, 'preacher') : null;
    const presenter = (!isWorship && !isMessage) ? getSegmentData(seg, 'presenter') : null;
    const translator = getSegmentData(seg, 'translator');
    
    const songs = getNormalizedSongs(seg);
    const messageTitle = isMessage ? getSegmentData(seg, 'messageTitle') : null;
    const verse = getSegmentData(seg, 'verse') || getSegmentData(seg, 'scripture_references');
    
    const notes = [];
    const desc = getSegmentData(seg, 'description');
    const descDetails = getSegmentData(seg, 'description_details');
    const coordNotes = getSegmentData(seg, 'coordinator_notes');
    const projNotes = getSegmentData(seg, 'projection_notes');
    const soundNotes = getSegmentData(seg, 'sound_notes');
    const ushersNotes = getSegmentData(seg, 'ushers_notes');
    const transNotes = getSegmentData(seg, 'translation_notes');
    const stageNotes = getSegmentData(seg, 'stage_decor_notes');

    if (desc) notes.push({ type: 'description', text: desc });
    if (descDetails) notes.push({ type: 'details', label: 'Notas Generales', text: descDetails });
    if (coordNotes) notes.push({ type: 'coord', label: 'Coord', text: coordNotes });
    if (projNotes) notes.push({ type: 'proj', label: 'Proyección', text: projNotes });
    if (soundNotes) notes.push({ type: 'sound', label: 'Sonido', text: soundNotes });
    if (ushersNotes) notes.push({ type: 'ushers', label: 'Ujieres', text: ushersNotes });
    if (transNotes) notes.push({ type: 'trans', label: 'Traducción', text: transNotes });
    if (stageNotes) notes.push({ type: 'stage', label: 'Stage & Decor', text: stageNotes });

    return {
      id: seg.id,
      title: seg.title || 'Sin título',
      timeLabel: startTimeStr,
      duration: seg.duration_min || seg.duration,
      segmentType,
      isSpecial: ['Especial', 'Special', 'special'].includes(segmentType),
      personLine: leader || preacher || presenter || null,
      translator,
      songs: songs.map(s => `${s.title}${s.lead ? ` (${s.lead})` : ''}`),
      messageTitle,
      verse,
      notes
    };
  });

  // Process announcements
  const selectedIds = serviceData.selected_announcements || [];
  const selectedAnnouncements = allAnnouncements.filter(a => selectedIds.includes(a.id));
  
  const fixedAnnouncements = selectedAnnouncements
    .filter(a => a.category === 'General')
    .map(a => ({
      id: a.id,
      title: a.title,
      content: sanitizeHtml(a.content),
      instructions: sanitizeHtml(a.instructions),
      hasVideo: a.has_video
    }));

  const dynamicAnnouncements = selectedAnnouncements
    .filter(a => a.category !== 'General' || a.isEvent)
    .map(a => ({
      id: a.id,
      title: a.isEvent ? a.name : a.title,
      dateLine: a.date_of_occurrence || a.start_date || null,
      content: sanitizeHtml(a.isEvent ? (a.announcement_blurb || a.description) : a.content),
      instructions: sanitizeHtml(a.instructions),
      hasVideo: a.has_video || a.announcement_has_video,
      isEmphasized: a.emphasize || a.category === 'Urgent'
    }));

  // Estimate content and calculate scales
  const { page1Weight, page2Weight } = estimateContentWeight(
    formattedSegments, 
    { fixed: fixedAnnouncements, dynamic: dynamicAnnouncements }
  );

  const MAX_PAGE1_WEIGHT = 45;
  const MAX_PAGE2_WEIGHT = 50;
  const page1Scale = settings.page1Scale || calculateScale(page1Weight, MAX_PAGE1_WEIGHT);
  const page2Scale = settings.page2Scale || calculateScale(page2Weight, MAX_PAGE2_WEIGHT);

  // Truncate if at minScale and still overflowing
  const shouldTruncate = page1Scale <= 0.72 || page2Scale <= 0.72;
  if (shouldTruncate) {
    formattedSegments.forEach(seg => {
      seg.notes = seg.notes.map(note => ({
        ...note,
        text: truncateText(note.text, 120)
      }));
    });
    
    fixedAnnouncements.forEach(ann => {
      ann.content = truncateText(ann.content, 200);
    });
    
    dynamicAnnouncements.forEach(ann => {
      ann.content = truncateText(ann.content, 150);
    });
  }

  // Format date
  const dateFormatted = serviceData.date 
    ? format(new Date(serviceData.date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
    : "—";

  // Team assignments
  const getTeamValue = (field) => {
    const val = serviceData[field];
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.main || '';
    return '';
  };

  return {
    serviceName: serviceData.name || "Orden de Servicio",
    date: dateFormatted,
    time: serviceData.time || '',
    dayOfWeek: serviceData.day_of_week || '',
    dateISO: serviceData.date || '',
    coordinators: getTeamValue('coordinators'),
    ujieres: getTeamValue('ujieres'),
    sound: getTeamValue('sound'),
    luces: getTeamValue('luces'),
    fotografia: getTeamValue('fotografia'),
    segments: formattedSegments,
    annFixed: fixedAnnouncements,
    annDynamic: dynamicAnnouncements,
    page1Scale,
    page2Scale
  };
}