/**
 * pdfmake-based Service Program PDF Generator
 * Generates deterministic, text-selectable PDFs for custom service programs
 * Supports two-column layout for multi-session services
 */

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getLogoDataUrl } from './pdfLogoData';
pdfMake.vfs = pdfFonts.vfs;

/**
 * Estimate optimal scale based on content density
 * Content area target: 620pt (accounts for ~80pt header + ~20pt footer)
 * Returns scale factor 0.75–1.0 to ensure content fits on one page
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
  // Light: 3-4 segments, minimal notes → 0.92
  // Medium: 5-7 segments, moderate notes → 0.82
  // Heavy: 8+ segments or 1500+ chars of notes → 0.75
  
  let scale = 1.0;
  if (segmentCount >= 8) scale -= 0.25;
  else if (segmentCount >= 5) scale -= 0.18;
  else if (segmentCount >= 3) scale -= 0.08;
  
  if (totalNoteLength > 1500) scale -= 0.10;
  else if (totalNoteLength > 800) scale -= 0.05;
  
  if (totalSongs > 10) scale -= 0.05;
  
  return Math.max(0.72, Math.min(1.0, scale));
}

export async function generateServiceProgramPDF(serviceData) {
  const globalScale = estimateOptimalScale(serviceData);
  const logoDataUrl = await getLogoDataUrl();
  
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [36, 36, 36, 56], // 0.5in margins + footer space
    
    content: [
      // Logo + Title Header (PDV Branding)
      {
        columns: [
          logoDataUrl ? {
            width: 50,
            image: logoDataUrl,
            fit: [50, 50],
            alignment: 'left'
          } : { width: 50, text: '' },
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: [
              {
                text: serviceData.name || 'ORDEN DE SERVICIO',
                fontSize: 18 * globalScale,
                bold: true,
                alignment: 'center',
                color: '#000000',
                margin: [0, 0, 0, 2]
              },
              {
                text: `${serviceData.day_of_week} ${formatDate(serviceData.date)}${serviceData.time ? ` • ${serviceData.time}` : ''}`,
                fontSize: 11 * globalScale,
                alignment: 'center',
                color: '#4B5563',
                margin: [0, 0, 0, 4]
              }
            ]
          },
          { width: '*', text: '' },
          { width: 50, text: '' }
        ],
        margin: [0, 0, 0, 8]
      },
      
      // Team info
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: buildTeamInfo(serviceData, globalScale)
          },
          { width: '*', text: '' }
        ],
        margin: [0, 0, 0, 8]
      },
      
      // Divider line
      { 
        canvas: [{ 
          type: 'line', 
          x1: 0, y1: 0, x2: 540, y2: 0, 
          lineWidth: 0.5, 
          lineColor: '#E5E7EB' 
        }], 
        margin: [0, 0, 0, 15] 
      },
      
      // Segments (single column for custom services)
      ...buildSegments(serviceData.segments || [], globalScale, globalScale)
    ],
    
    footer: () => ({
      text: '¡Atrévete a cambiar!',
      color: 'white',
      fontSize: 10,
      bold: true,
      alignment: 'center',
      background: '#1F8A70',
      padding: [8, 10, 8, 10],
      margin: [0, 0, 0, 0]
    }),
    
    defaultStyle: { 
      fontSize: 10.5, 
      lineHeight: 1.3,
      color: '#374151'
    }
  };
  
  return pdfMake.createPdf(docDefinition, {});
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

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
    color: '#4B5563',
    alignment: 'center'
  });
  
  return items;
}

export function buildSegments(segments, bodyFontScale = 1, titleFontScale = 1) {
  // Support both legacy (globalScale) and new (separate body/title) parameters
  const globalScale = bodyFontScale; // For backward compat in segment building
  
  if (!segments || segments.length === 0) return [];
  
  return segments.flatMap((seg, idx) => {
    const items = [];
    
    // Segment title with time
    const titleParts = [];
    if (seg.start_time || seg.duration) {
      const timeStr = seg.start_time || `+${seg.duration}min`;
      titleParts.push({ text: timeStr, color: '#4B5563', fontSize: 10.5 * globalScale, bold: true });
      titleParts.push({ text: '  ', fontSize: 10.5 * globalScale });
    }
    titleParts.push({ text: seg.title, fontSize: 11 * globalScale, bold: true, color: '#000000' });
    
    if (seg.duration) {
      titleParts.push({ text: ` (${seg.duration} min)`, fontSize: 10 * globalScale, color: '#6B7280' });
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
          { text: 'Dirige: ', fontSize: 10 * globalScale, color: '#374151' },
          { text: leader, fontSize: 11 * globalScale, bold: true, color: '#2563EB' }
        ],
        margin: [5, 0, 0, 2]
      });
    } else if (preacher) {
      items.push({
        text: preacher,
        fontSize: 11 * globalScale,
        bold: true,
        color: '#2563EB',
        margin: [5, 0, 0, 2]
      });
    } else if (presenter) {
      items.push({
        text: presenter,
        fontSize: 11 * globalScale,
        bold: true,
        color: '#2563EB',
        margin: [5, 0, 0, 2]
      });
    }
    
    // Translator
    const translator = seg.data?.translator || seg.translator;
    if (translator) {
      items.push({
        text: `🌐 ${translator}`,
        fontSize: 9.5 * globalScale,
        color: '#6B7280',
        italics: true,
        margin: [5, 0, 0, 2]
      });
    }
    
    // Songs
    const songs = seg.data?.songs || seg.songs;
    if (songs && Array.isArray(songs) && songs.some(s => s.title)) {
      songs.filter(s => s.title).forEach(song => {
        const songText = [{ text: `- ${song.title}`, fontSize: 10 * globalScale, color: '#374151' }];
        if (song.lead) songText.push({ text: ` (${song.lead})`, fontSize: 9 * globalScale, color: '#6B7280' });
        items.push({ text: songText, margin: [5, 0, 0, 1] });
      });
    }
    
    // Message title
    const messageTitle = seg.data?.messageTitle || seg.messageTitle;
    if (messageTitle) {
      items.push({
        text: messageTitle,
        fontSize: 9.5 * globalScale,
        color: '#6B7280',
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
        color: '#6B7280',
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