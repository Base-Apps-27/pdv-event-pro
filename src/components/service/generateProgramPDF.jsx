/**
 * pdfmake-based Service Program Helpers
 * Shared logic for building program segments and team info
 */

import pdfMake from 'pdfmake/build/pdfmake';
import { getLogoDataUrl } from './pdfLogoData';
import { BRAND, formatDate } from './pdfUtils';

/**
 * Estimate optimal scale based on content density
 * Returns scale factor 0.65–1.0 to ensure content fits on one page
 */
export function estimateOptimalScale(serviceData) {
  const segments = serviceData.segments || [];
  
  // Count content density
  const segmentCount = segments.length;
  const totalNoteLength = segments.reduce((sum, seg) => {
    const notes = [
      seg.coordinator_notes, seg.projection_notes, seg.sound_notes, 
      seg.ushers_notes, seg.translation_notes, seg.stage_decor_notes, 
      seg.description_details, seg.description
    ].join(' ').length;
    return sum + notes;
  }, 0);
  const totalSongs = segments.reduce((sum, seg) => {
    const songs = seg.songs || [];
    return sum + songs.filter(s => s.title).length;
  }, 0);
  
  // Heuristic: higher content = lower scale
  let scale = 1.0;
  
  // Segment-based reduction
  if (segmentCount >= 11) scale -= 0.32;     // Very long: 0.68
  else if (segmentCount >= 8) scale -= 0.25; // Heavy: 0.75
  else if (segmentCount >= 5) scale -= 0.15; // Medium: 0.85
  else if (segmentCount >= 3) scale -= 0.05; // Light: 0.95
  
  // Notes-based reduction
  if (totalNoteLength > 2500) scale -= 0.05;
  else if (totalNoteLength > 1500) scale -= 0.03;
  else if (totalNoteLength > 800) scale -= 0.02;
  
  // Songs-based reduction
  if (totalSongs > 15) scale -= 0.05;
  else if (totalSongs > 10) scale -= 0.03;
  
  return Math.max(0.65, Math.min(1.0, scale));
}

// Re-export formatDate for backward compatibility if needed, 
// though consumers should prefer importing from pdfUtils
export { formatDate };

export function buildTeamInfo(serviceData, globalScale = 1) {
  const items = [];
  const teams = [];
  
  if (serviceData.coordinators?.main) teams.push({ label: 'Coordinador', value: serviceData.coordinators.main });
  if (serviceData.ujieres?.main) teams.push({ label: 'Ujier', value: serviceData.ujieres.main });
  if (serviceData.sound?.main) teams.push({ label: 'Sonido', value: serviceData.sound.main });
  if (serviceData.luces?.main) teams.push({ label: 'Luces', value: serviceData.luces.main });
  if (serviceData.fotografia?.main) teams.push({ label: 'Foto', value: serviceData.fotografia.main });
  
  if (teams.length === 0) return items;
  
  const teamText = teams.map(t => `${t.label}: ${t.value}`).join(' / ');
  items.push({
    text: teamText,
    fontSize: 9 * globalScale,
    color: BRAND.GRAY,
    alignment: 'center'
  });
  
  return items;
}

export function buildSegments(segments, bodyFontScale = 1, titleFontScale = 1) {
  const globalScale = bodyFontScale; // For backward compat in segment building
  
  if (!segments || segments.length === 0) return [];
  
  return segments.flatMap((seg, idx) => {
    const items = [];
    
    // Segment title with time
    const titleParts = [];
    if (seg.start_time || seg.duration) {
      const timeStr = seg.start_time || `+${seg.duration}min`;
      titleParts.push({ text: timeStr, color: BRAND.GRAY, fontSize: 10.5 * globalScale, bold: true });
      titleParts.push({ text: '  ', fontSize: 10.5 * globalScale });
    }
    titleParts.push({ text: seg.title, fontSize: 11 * globalScale, bold: true, color: BRAND.BLACK });
    
    if (seg.duration) {
      titleParts.push({ text: ` (${seg.duration} min)`, fontSize: 10 * globalScale, color: BRAND.GRAY });
    }
    
    items.push({
      text: titleParts,
      margin: [0, idx > 0 ? 8 : 0, 0, 3]
    });
    
    // Leader/Presenter/Preacher (blue name)
    const leader = seg.data?.leader || seg.leader;
    const presenter = seg.data?.presenter || seg.presenter;
    const preacher = seg.data?.preacher || seg.preacher;
    
    if (leader) {
      items.push({
        text: [
          { text: 'Dirige: ', fontSize: 10 * globalScale, color: BRAND.GRAY },
          { text: leader, fontSize: 11 * globalScale, bold: true, color: BRAND.BLUE }
        ],
        margin: [5, 0, 0, 2]
      });
    } else if (preacher) {
      items.push({
        text: preacher,
        fontSize: 11 * globalScale,
        bold: true,
        color: BRAND.BLUE,
        margin: [5, 0, 0, 2]
      });
    } else if (presenter) {
      items.push({
        text: presenter,
        fontSize: 11 * globalScale,
        bold: true,
        color: BRAND.BLUE,
        margin: [5, 0, 0, 2]
      });
    }
    
    // Translator
    const translator = seg.data?.translator || seg.translator;
    if (translator) {
      items.push({
        text: `🌐 ${translator}`,
        fontSize: 9.5 * globalScale,
        color: BRAND.GRAY,
        italics: true,
        margin: [5, 0, 0, 2]
      });
    }
    
    // Songs
    const songs = seg.data?.songs || seg.songs;
    if (songs && Array.isArray(songs) && songs.some(s => s.title)) {
      songs.filter(s => s.title).forEach(song => {
        const songText = [{ text: `- ${song.title}`, fontSize: 10 * globalScale, color: BRAND.GRAY }];
        if (song.lead) songText.push({ text: ` (${song.lead})`, fontSize: 9 * globalScale, color: BRAND.GRAY });
        items.push({ text: songText, margin: [5, 0, 0, 1] });
      });
    }
    
    // Message title
    const messageTitle = seg.data?.messageTitle || seg.messageTitle;
    if (messageTitle) {
      items.push({
        text: messageTitle,
        fontSize: 9.5 * globalScale,
        color: BRAND.GRAY,
        italics: true,
        margin: [5, 2, 0, 2]
      });
    }
    
    // Verse
    const verse = seg.data?.verse || seg.verse;
    if (verse) {
      items.push({
        text: `📖 ${verse}`,
        fontSize: 9.5 * globalScale,
        color: BRAND.GRAY,
        italics: true,
        margin: [5, 2, 0, 2]
      });
    }
    
    // Description (green box)
    const description = seg.data?.description || seg.description;
    if (description) {
      items.push({
        text: description,
        fontSize: 10 * globalScale,
        color: '#14532D',
        background: '#F0FDF4',
        margin: [0, 4, 0, 2],
        padding: [4, 4, 4, 4]
      });
    }
    
    // Notes
    const addNote = (label, content, color) => {
      if (content) {
        items.push({
          text: [
            { text: `${label}: `, bold: true, fontSize: 9 * globalScale },
            { text: content, fontSize: 9 * globalScale }
          ],
          color: color,
          margin: [5, 2, 0, 0]
        });
      }
    };
    
    addNote('📋 Coord', seg.data?.coordinator_notes || seg.coordinator_notes, '#1E40AF');
    addNote('📽️ Proyección', seg.data?.projection_notes || seg.projection_notes, '#1E40AF');
    addNote('🔊 Sonido', seg.data?.sound_notes || seg.sound_notes, '#991B1B');
    addNote('🤝 Ujieres', seg.data?.ushers_notes || seg.ushers_notes, '#14532D');
    
    return items;
  });
}