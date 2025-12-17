import React, { forwardRef } from 'react';

// Fixed dimensions for letter size at 96 DPI (8.5" x 11")
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;

// Utility to format date in Spanish
function formatDateSpanish(dateStr) {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const date = new Date(dateStr + 'T12:00:00');
  return `Domingo ${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

// Calculate segment time
function calculateSegmentTime(segments, index, startHour, startMin) {
  let totalMinutes = 0;
  for (let i = 0; i < index; i++) {
    if (segments[i] && segments[i].type !== 'break') {
      totalMinutes += segments[i].duration || 0;
    }
  }
  const totalMins = startHour * 60 + startMin + totalMinutes;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function stripCuePrefix(text) {
  if (!text) return '';
  return text.replace(/^CUE[:\s]*/gi, '').trim();
}

// ===== PAGE 1: SERVICE ORDER =====
export const ServiceOrderPage = forwardRef(({ service, selectedDate }, ref) => {
  const segments930 = (service?.['9:30am'] || []).filter(s => s.type !== 'break');
  const segments1130 = (service?.['11:30am'] || []).filter(s => s.type !== 'break');

  const coord = service?.coordinators?.['9:30am'] || service?.coordinators?.['11:30am'] || '-';
  const ujier = service?.ujieres?.['9:30am'] || service?.ujieres?.['11:30am'] || '-';
  const sonido = service?.sound?.['9:30am'] || '-';
  const luces = service?.luces?.['9:30am'] || service?.luces?.['11:30am'] || '-';

  const renderSegment = (seg, allSegs, idx, startH, startM) => {
    const time = calculateSegmentTime(allSegs, idx, startH, startM);
    
    return (
      <div key={idx} className="mb-2">
        {/* Time + Title */}
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-[#b91c1c] font-bold text-[9px]">{time}</span>
          <span className="font-bold text-[9px] text-[#1a1a1a]">{(seg.title || '').toUpperCase()}</span>
          {seg.duration && <span className="text-[#6b7280] text-[8px]">({seg.duration} mins)</span>}
        </div>

        {/* Leader */}
        {seg.data?.leader && (
          <div className="text-[8.5px] text-[#4b5563]">
            Dirige: <span className="font-bold text-[#1f8a70]">P. {seg.data.leader}</span>
          </div>
        )}

        {/* Projection notes */}
        {seg.data?.projection_notes && (
          <div className="text-[8px] text-[#6b7280] italic">- {seg.data.projection_notes}</div>
        )}

        {/* Songs */}
        {seg.songs?.filter(s => s.title).map((s, sIdx) => (
          <div key={sIdx} className="text-[8px] text-[#4b5563]">
            - {s.title}{s.lead ? ` (${s.lead})` : ''}
          </div>
        ))}

        {/* Ministry section */}
        {seg.data?.ministry_leader && (
          <div className="mt-1">
            <div className="font-bold text-[8.5px] text-[#1a1a1a]">Ministración de Sanidad y Milagros</div>
            <div className="text-[8.5px]">
              <span className="font-bold text-[#1f8a70]">P. {seg.data.ministry_leader}</span>
              <span className="text-[#6b7280] text-[7.5px]"> (4 mins.)</span>
            </div>
            <div className="text-[7.5px] text-[#6b7280] italic">(Debe estar listo (a) desde que inicia la adoración)</div>
          </div>
        )}

        {/* Presenter */}
        {seg.data?.presenter && !seg.data?.ministry_leader && (
          <div className="text-[8.5px] font-bold text-[#1f8a70]">P. {seg.data.presenter}</div>
        )}

        {/* Preacher */}
        {seg.data?.preacher && (
          <div className="text-[8.5px] font-bold text-[#1f8a70]">A. {seg.data.preacher}</div>
        )}

        {/* Message title */}
        {seg.data?.title && (
          <div className="text-[8px] text-[#4b5563]">{seg.data.title}</div>
        )}

        {/* Sound notes */}
        {seg.data?.sound_notes && (
          <div className="text-[7.5px] text-[#6b7280] italic">{seg.data.sound_notes}</div>
        )}

        {/* Actions/Cues */}
        {seg.actions?.map((action, aIdx) => {
          let txt = stripCuePrefix(action.label);
          if (action.timing === 'before_end' && action.offset_min) {
            txt += ` (${action.offset_min} min antes)`;
          }
          return (
            <div key={aIdx} className="text-[7.5px] text-[#6b7280] italic">{txt}</div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      ref={ref}
      style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, position: 'absolute', left: '-9999px', top: 0 }}
      className="bg-white font-sans"
    >
      {/* Header */}
      <div className="px-10 pt-8">
        <div className="flex items-start gap-3">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" 
            alt="Logo" 
            className="w-8 h-8"
          />
          <div className="flex-1 text-center">
            <h1 className="text-[20px] font-bold text-[#1a1a1a] tracking-wide">ORDEN DE SERVICIO</h1>
            <p className="text-[11px] text-[#4b5563]">{formatDateSpanish(selectedDate)}</p>
          </div>
          <div className="w-8" /> {/* Spacer for balance */}
        </div>

        {/* Team info bar */}
        <div className="border-t border-[#e5e7eb] mt-3 pt-2">
          <div className="text-[8px] text-[#4b5563] text-center">
            <span className="font-bold">Coordinador:</span> <span className="text-[#1f8a70]">{coord}</span>
            <span className="mx-3">|</span>
            <span className="font-bold">Ujier:</span> <span className="text-[#1f8a70]">{ujier}</span>
            <span className="mx-3">|</span>
            <span className="font-bold">Sonido:</span> <span className="text-[#1f8a70]">{sonido}</span>
            <span className="mx-3">|</span>
            <span className="font-bold">Luces:</span> <span className="text-[#1f8a70]">{luces}</span>
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="px-10 pt-4 flex gap-6">
        {/* 9:30 Column */}
        <div className="flex-1">
          <h2 className="text-[13px] font-bold text-[#1a1a1a] border-b-2 border-[#1f8a70] pb-1 mb-3 inline-block">9:30 A.M.</h2>
          <div>
            {segments930.map((seg, idx) => renderSegment(seg, segments930, idx, 9, 30))}
          </div>
        </div>

        {/* 11:30 Column */}
        <div className="flex-1">
          <h2 className="text-[13px] font-bold text-[#1a1a1a] border-b-2 border-[#1f8a70] pb-1 mb-3 inline-block">11:30 A.M.</h2>
          <div>
            {segments1130.map((seg, idx) => renderSegment(seg, segments1130, idx, 11, 30))}
          </div>
        </div>
      </div>

      {/* Receso */}
      <div className="text-center mt-4">
        <div className="text-[11px] font-bold text-[#1a1a1a]">11:00AM A 11:30AM</div>
        <div className="text-[11px] font-bold text-[#1a1a1a]">RECESO</div>
      </div>

      {/* Footer */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-7 flex items-center justify-center"
        style={{ backgroundColor: '#8dc63f' }}
      >
        <span className="text-[11px] font-bold text-white">¡Atrévete a cambiar!</span>
      </div>
    </div>
  );
});

ServiceOrderPage.displayName = 'ServiceOrderPage';

// ===== PAGE 2: ANNOUNCEMENTS =====
export const AnnouncementsPage = forwardRef(({ announcements, selectedDate }, ref) => {
  if (!announcements || announcements.length === 0) return null;

  // Split into two columns
  const col1 = announcements.filter((_, i) => i % 2 === 0);
  const col2 = announcements.filter((_, i) => i % 2 === 1);

  const renderAnnouncement = (ann, idx) => (
    <div key={idx} className="mb-4">
      {/* Title with accent bar */}
      <div className="flex items-start gap-2">
        <div className="w-[3px] h-4 bg-[#1f8a70] mt-0.5" />
        <h3 className="text-[10px] font-bold text-[#1a1a1a]">{ann.title || ann.name}</h3>
      </div>

      {/* Content */}
      {(ann.content || ann.announcement_blurb || ann.description) && (
        <div className="text-[8.5px] text-[#4b5563] mt-1 ml-[11px]">
          {ann.content || ann.announcement_blurb || ann.description}
        </div>
      )}

      {/* CUE box */}
      {ann.instructions && (
        <div className="ml-[11px] mt-2 p-2 rounded bg-[#fef3c7] border border-[#fbbf24]">
          <div className="text-[7px] font-bold text-[#92400e]">CUE PARA EL ANUNCIADOR</div>
          <div className="text-[7.5px] text-[#92400e] italic mt-1">
            {stripCuePrefix(ann.instructions)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div 
      ref={ref}
      style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, position: 'absolute', left: '-9999px', top: 0 }}
      className="bg-white font-sans"
    >
      {/* Header */}
      <div className="px-10 pt-8 text-center">
        <img 
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" 
          alt="Logo" 
          className="w-8 h-8 mx-auto"
        />
        <h1 className="text-[20px] font-bold text-[#1a1a1a] tracking-wide mt-2">ANUNCIOS</h1>
        <p className="text-[11px] text-[#4b5563]">{formatDateSpanish(selectedDate)}</p>
      </div>

      {/* Two columns */}
      <div className="px-10 pt-6 flex gap-6">
        <div className="flex-1">
          {col1.map((ann, idx) => renderAnnouncement(ann, idx))}
        </div>
        <div className="flex-1">
          {col2.map((ann, idx) => renderAnnouncement(ann, idx))}
        </div>
      </div>

      {/* Footer */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-7 flex items-center justify-center"
        style={{ backgroundColor: '#8dc63f' }}
      >
        <span className="text-[11px] font-bold text-white">¡Atrévete a cambiar!</span>
      </div>
    </div>
  );
});

AnnouncementsPage.displayName = 'AnnouncementsPage';

export { PAGE_WIDTH, PAGE_HEIGHT };