/**
 * pdfmake-based Service Program PDF Generator
 * Generates deterministic, text-selectable PDFs for custom service programs
 * Supports two-column layout for multi-session services
 */

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
pdfMake.vfs = pdfFonts.vfs;

export function generateServiceProgramPDF(serviceData) {
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [36, 36, 36, 56], // 0.5in margins + footer space
    
    content: [
      // Header
      { 
        text: serviceData.name || 'ORDEN DE SERVICIO', 
        fontSize: 18, 
        bold: true, 
        alignment: 'center', 
        margin: [0, 0, 0, 8],
        color: '#000000'
      },
      { 
        text: `${serviceData.day_of_week} ${formatDate(serviceData.date)}${serviceData.time ? ` • ${serviceData.time}` : ''}`, 
        fontSize: 11, 
        alignment: 'center', 
        margin: [0, 0, 0, 5],
        color: '#4B5563'
      },
      
      // Team info
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: buildTeamInfo(serviceData)
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
      ...buildSegments(serviceData.segments || [])
    ],
    
    footer: (currentPage, pageCount) => ({
      stack: [
        {
          canvas: [{
            type: 'rect',
            x: 0, y: 0,
            w: 612, h: 20,
            color: '#1F8A70' // PDV teal
          }],
          margin: [0, 0, 0, 0]
        },
        {
          text: '¡Atrévete a cambiar!',
          alignment: 'center',
          fontSize: 9,
          bold: true,
          color: 'white',
          margin: [0, -14, 0, 0]
        }
      ],
      margin: [0, 772, 0, 0]
    }),
    
    defaultStyle: { 
      font: 'Helvetica', 
      fontSize: 10.5, 
      lineHeight: 1.3,
      color: '#374151'
    }
  };
  
  return pdfMake.createPdf(docDefinition);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

function buildTeamInfo(serviceData) {
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
    fontSize: 9,
    color: '#4B5563',
    alignment: 'center'
  });
  
  return items;
}

function buildSegments(segments) {
  if (!segments || segments.length === 0) return [];
  
  return segments.flatMap((seg, idx) => {
    const items = [];
    
    // Segment title with time
    const titleParts = [];
    if (seg.start_time || seg.duration) {
      const timeStr = seg.start_time || `+${seg.duration}min`;
      titleParts.push({ text: timeStr, color: '#4B5563', fontSize: 10.5, bold: true });
      titleParts.push({ text: '  ', fontSize: 10.5 });
    }
    titleParts.push({ text: seg.title, fontSize: 11, bold: true, color: '#000000' });
    
    if (seg.duration) {
      titleParts.push({ text: ` (${seg.duration} min)`, fontSize: 10, color: '#6B7280' });
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
          { text: 'Dirige: ', fontSize: 10, color: '#374151' },
          { text: leader, fontSize: 11, bold: true, color: '#2563EB' }
        ],
        margin: [5, 0, 0, 2]
      });
    } else if (preacher) {
      items.push({
        text: preacher,
        fontSize: 11,
        bold: true,
        color: '#2563EB',
        margin: [5, 0, 0, 2]
      });
    } else if (presenter) {
      items.push({
        text: presenter,
        fontSize: 11,
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
        fontSize: 9.5,
        color: '#6B7280',
        italics: true,
        margin: [5, 0, 0, 2]
      });
    }
    
    // Songs
    const songs = seg.data?.songs || seg.songs;
    if (songs && Array.isArray(songs) && songs.some(s => s.title)) {
      songs.filter(s => s.title).forEach(song => {
        const songText = [{ text: `- ${song.title}`, fontSize: 10, color: '#374151' }];
        if (song.lead) songText.push({ text: ` (${song.lead})`, fontSize: 9, color: '#6B7280' });
        items.push({ text: songText, margin: [5, 0, 0, 1] });
      });
    }
    
    // Message title
    const messageTitle = seg.data?.messageTitle || seg.messageTitle;
    if (messageTitle) {
      items.push({
        text: messageTitle,
        fontSize: 9.5,
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
        fontSize: 9.5,
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
        fontSize: 10,
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
            { text: `${label}: `, bold: true, fontSize: 9 },
            { text: content, fontSize: 9 }
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