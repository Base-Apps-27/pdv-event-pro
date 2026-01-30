/**
 * CUSTOM SERVICE PDF GENERATOR
 * 
 * SYNC PROTOCOL: See components/service/PDF_SYNC_PROTOCOL.md
 * - Shares rendering standards with generateWeeklyProgramPDF.jsx (colors, fonts, presenter hierarchy)
 * - Intentional divergence: Single-column layout, flat segment structure, sub_asignaciones array
 * - When updating colors, fonts, or label hierarchy: UPDATE BOTH GENERATORS
 * - When adding layout features: clarify if it's custom-only or applies to weekly too
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
   const globalScale = bodyFontScale;

   if (!segments || segments.length === 0) return [];

   return segments.flatMap((seg, idx) => {
     const items = [];

     // Weekly Service style: Time + Title + Type Tag + Duration
     const titleParts = [];
     if (seg.start_time) {
       titleParts.push({ text: seg.start_time, bold: true, color: BRAND.BLACK, fontSize: 10 * globalScale });
       titleParts.push({ text: '  ', fontSize: 10 * globalScale });
     }

     titleParts.push({ text: seg.title.toUpperCase(), bold: true, color: BRAND.BLACK, fontSize: 10.5 * globalScale });

     // Segment type tag (WORSHIP, WELCOME, OFFERING, etc.)
     const segmentType = seg.segment_type || seg.type;
     if (segmentType) {
       const typeLabel = segmentType.toUpperCase();
       titleParts.push({ text: `  ${typeLabel}  `, color: '#374151', background: '#F3F4F6', fontSize: 7 * globalScale, bold: true });
     }

     if (seg.duration) {
       titleParts.push({ text: ` (${seg.duration} min)`, color: BRAND.GRAY, fontSize: 9 * globalScale });
     }

     items.push({
       text: titleParts,
       margin: [0, idx > 0 ? 6 : 0, 0, 2]
     });

     // Presenter/Leader/Preacher
     const segType = seg.segment_type || seg.type || '';
     const isWorship = ['Alabanza', 'worship'].includes(segType);
     const isMessage = ['Plenaria', 'message'].includes(segType);

     const leader = seg.data?.leader || seg.leader;
     const presenter = seg.data?.presenter || seg.presenter;
     const preacher = seg.data?.preacher || seg.preacher;
    
    // Strict hierarchy per segment type
    if (isWorship && leader) {
      items.push({
        text: [
          { text: 'DIRIGE: ', bold: true, color: '#16A34A', fontSize: 9 * globalScale },
          { text: leader, bold: true, color: '#16A34A', fontSize: 10 * globalScale }
        ],
        margin: [8, 0, 0, 1]
      });
    } else if (isMessage && preacher) {
      items.push({
        text: [
          { text: 'PREDICA: ', bold: true, color: '#4F46E5', fontSize: 9 * globalScale },
          { text: preacher, bold: true, color: '#4F46E5', fontSize: 10 * globalScale }
        ],
        margin: [8, 0, 0, 1]
      });
    } else if (!isWorship && !isMessage && presenter) {
      items.push({
        text: [
          { text: 'MINISTRA: ', bold: true, color: '#2563EB', fontSize: 9 * globalScale },
          { text: presenter, bold: true, color: '#2563EB', fontSize: 10 * globalScale }
        ],
        margin: [8, 0, 0, 1]
      });
    }
    
    // Translator - with mode distinction (InPerson vs RemoteBooth)
    const translator = seg.data?.translator || seg.translator || seg.translator_name;
    const translationMode = seg.translation_mode || seg.data?.translation_mode;
    if (translator || seg.requires_translation) {
      const isRemoteBooth = translationMode === 'RemoteBooth';
      if (translator) {
        items.push({
          text: [
            { text: isRemoteBooth ? '🎧 Trad-Cabina: ' : '🎙️ Trad-Tarima: ', fontSize: 8.5 * globalScale, color: isRemoteBooth ? '#0891B2' : '#7C3AED', italics: true },
            { text: translator, fontSize: 8.5 * globalScale, color: isRemoteBooth ? '#0E7490' : '#5B21B6', italics: true, bold: true }
          ],
          margin: [8, 0, 0, 1]
        });
      }
    }

    // Panel moderators/panelists
    const panelMods = seg.data?.panel_moderators || seg.panel_moderators;
    const panelists = seg.data?.panel_panelists || seg.panel_panelists;
    if (panelMods || panelists) {
      if (panelMods) {
        items.push({
          text: [
            { text: 'MODERADOR(ES): ', bold: true, color: '#B45309', fontSize: 9 * globalScale },
            { text: panelMods, bold: true, color: '#92400E', fontSize: 9.5 * globalScale }
          ],
          margin: [8, 0, 0, 1]
        });
      }
      if (panelists) {
        items.push({
          text: [
            { text: 'PANELISTA(S): ', bold: true, color: '#B45309', fontSize: 9 * globalScale },
            { text: panelists, bold: true, color: '#92400E', fontSize: 9.5 * globalScale }
          ],
          margin: [8, 0, 0, 1]
        });
      }
    }

    // Songs - Boxed style (Slate-50)
    const songs = seg.data?.songs || seg.songs;
    if (songs && Array.isArray(songs) && songs.some(s => s.title)) {
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'CANCIONES:', bold: true, fontSize: 8.5 * globalScale, color: '#334155', margin: [0, 0, 0, 2] },
              ...songs.filter(s => s.title).map((song, i) => ({
                text: [
                  { text: `${i + 1}. `, color: '#64748B', fontSize: 8.5 * globalScale },
                  { text: song.title, color: '#0F172A', fontSize: 9 * globalScale, bold: true },
                  song.lead ? { text: ` (${song.lead})`, color: '#64748B', fontSize: 8.5 * globalScale, italics: true } : '',
                  song.key ? { text: ` [${song.key}]`, color: '#64748B', fontSize: 8 * globalScale, bold: true } : ''
                ],
                margin: [0, 0, 0, 1]
              }))
            ],
            fillColor: '#F8FAFC',
            border: [true, true, true, true],
            borderColor: ['#E2E8F0', '#E2E8F0', '#E2E8F0', '#E2E8F0'],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 4, 0, 4]
      });
    }

    // DIVERGENCE (per PDF_SYNC_PROTOCOL.md): Sub-asignaciones are CUSTOM-ONLY
    // Custom services use flat seg.sub_asignaciones[] array (new feature)
    // Weekly services use seg.sub_assignments[] (legacy DB structure)
    // Do NOT apply this logic to generateWeeklyProgramPDF.jsx
    const subAsignaciones = seg.sub_asignaciones || [];
    if (subAsignaciones.length > 0) {
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'MINISTRACIÓN DE SANIDAD Y MILAGROS:', bold: true, fontSize: 8.5 * globalScale, color: '#5B21B6', margin: [0, 0, 0, 2] },
              ...subAsignaciones.map(sub => ({
                text: [
                  { text: sub.presenter || 'TBD', bold: true, color: '#7C3AED', fontSize: 9 * globalScale },
                  sub.duration ? { text: ` (${sub.duration} min)`, color: '#64748B', fontSize: 8.5 * globalScale } : ''
                ],
                margin: [0, 0, 0, 1]
              }))
            ],
            fillColor: '#FAF5FF',
            border: [true, true, true, true],
            borderColor: ['#E9D5FF', '#E9D5FF', '#E9D5FF', '#E9D5FF'],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 4]
      });
    }
    
    // Message/Details box (Blue-50 style)
    const messageTitle = seg.data?.messageTitle || seg.data?.title;
    if (messageTitle && isMessage) {
      const msgContent = [
        {
          text: [
            { text: 'MENSAJE: ', bold: true, color: '#1E40AF' },
            { text: messageTitle, color: '#1E3A8A' }
          ],
          fontSize: 9 * globalScale
        }
      ];
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: msgContent,
            fillColor: '#EFF6FF',
            border: [true, true, true, true],
            borderColor: ['#BFDBFE', '#BFDBFE', '#BFDBFE', '#BFDBFE'],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Breakout rooms consolidated block (no scriptures; per-room summary)
    const isBreakout = (seg.segment_type || seg.type) === 'Breakout';
    const breakoutRooms = seg.breakout_rooms || [];
    if (isBreakout && Array.isArray(breakoutRooms) && breakoutRooms.length > 0) {
      const roomStack = [
        { text: 'SESIONES PARALELAS', bold: true, color: '#B45309', fontSize: 9 * globalScale, margin: [0, 0, 0, 2] },
        ...breakoutRooms.map((room, idx) => ({
          stack: [
            { text: `${room.topic || `Sala ${idx + 1}`}`, bold: true, color: '#111827', fontSize: 9.5 * globalScale },
            room.hosts ? { text: `Anfitrión: ${room.hosts}`, color: '#4338CA', fontSize: 8 * globalScale } : '',
            room.speakers ? { text: `Presentador: ${room.speakers}`, color: '#2563EB', fontSize: 8 * globalScale } : '',
            room.requires_translation ? { text: `${room.translation_mode === 'RemoteBooth' ? 'Traducción Remota' : 'Traducción en Persona'}${room.translator_name ? ` — ${room.translator_name}` : ''}`, color: '#7C3AED', fontSize: 7.5 * globalScale, italics: true } : '',
            room.general_notes ? { text: `Prod: ${room.general_notes}`, color: '#6B7280', fontSize: 7.5 * globalScale } : '',
            room.other_notes ? { text: `Otras: ${room.other_notes}`, color: '#6B7280', fontSize: 7.5 * globalScale } : ''
          ],
          margin: [0, 1, 0, 2]
        }))
      ];

      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: roomStack,
            fillColor: '#FFFBEB',
            border: [true, true, true, true],
            borderColor: ['#FCD34D', '#FCD34D', '#FCD34D', '#FCD34D'],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Prep notes box (Gray-50)
    const prepNotes = seg.data?.description_details || seg.description_details;
    if (prepNotes) {
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'PREPARACIÓN', bold: true, fontSize: 7.5 * globalScale, color: '#6B7280', margin: [0, 0, 0, 2] },
              { text: prepNotes, color: '#4B5563', fontSize: 8 * globalScale }
            ],
            fillColor: '#F9FAFB',
            border: [true, true, true, true],
            borderColor: ['#E5E7EB', '#E5E7EB', '#E5E7EB', '#E5E7EB'],
            margin: [4, 2, 4, 2]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // During segment notes
    const duringNotes = [
      { label: 'COORDINACIÓN', val: seg.data?.coordinator_notes },
      { label: 'PROYECCIÓN', val: seg.data?.projection_notes },
      { label: 'SONIDO', val: seg.data?.sound_notes },
      { label: 'UJIERES', val: seg.data?.ushers_notes }
    ].filter(n => n.val);

    if (duringNotes.length > 0) {
      const noteContent = duringNotes.map(n => ({
        text: [
          { text: `${n.label}: `, bold: true, color: '#6B7280', fontSize: 7.5 * globalScale },
          { text: n.val, color: '#4B5563', fontSize: 7.5 * globalScale }
        ],
        margin: [0, 1, 0, 1]
      }));

      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: noteContent,
            fillColor: '#F9FAFB',
            border: [true, true, true, true],
            borderColor: ['#E5E7EB', '#E5E7EB', '#E5E7EB', '#E5E7EB'],
            margin: [4, 2, 4, 2]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    return items;
  });
}