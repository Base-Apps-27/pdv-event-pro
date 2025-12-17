import React from "react";
import { addMinutes, parse, format as formatDate } from "date-fns";
import { es } from "date-fns/locale";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png";

export default function ServicePdfPage1({ serviceData, selectedDate, scale = 100 }) {
  // Scale affects font size of content only, not page dimensions
  const fontScale = scale / 100;
  
  const renderServiceColumn = (timeSlot, isRight = false) => {
    const segments = serviceData?.[timeSlot]?.filter(s => s.type !== 'break') || [];
    
    return (
      <div className="pdf-service-column">
        <div className="pdf-column-header">
          {timeSlot === "9:30am" ? "9:30 A.M." : "11:30 A.M."}
        </div>
        
        {serviceData?.pre_service_notes?.[timeSlot] && (
          <div className="pdf-pre-service-note">
            {serviceData.pre_service_notes[timeSlot]}
          </div>
        )}
        
        {segments.map((segment, idx) => {
          let currentTime = parse(timeSlot, "h:mma", new Date());
          for (let i = 0; i < idx; i++) {
            const seg = serviceData[timeSlot][i];
            if (seg.type !== 'break' && seg.type !== 'ministry') {
              currentTime = addMinutes(currentTime, seg.duration || 0);
            }
          }
          const segmentTime = formatDate(currentTime, "h:mm a");
          
          return (
            <div key={idx} className="pdf-segment">
              <div className="pdf-segment-header">
                <span className="pdf-time">{segmentTime}</span>
                <span className="pdf-segment-title">{segment.title}</span>
                {segment.duration && (
                  <span className="pdf-duration">({segment.duration} min)</span>
                )}
              </div>
              
              {segment.data?.leader && (
                <div className="pdf-detail">
                  Dirige: <span className="pdf-name">{segment.data.leader}</span>
                </div>
              )}
              
              {isRight && segment.data?.translator && (
                <div className="pdf-detail">
                  Traduce: <span className="pdf-name">{segment.data.translator}</span>
                </div>
              )}
              
              {segment.songs?.filter(s => s.title).length > 0 && (
                <div className="pdf-songs">
                  {segment.songs.filter(s => s.title).map((song, sIdx) => (
                    <div key={sIdx} className="pdf-song-item">
                      • {song.title} {song.lead && <span className="pdf-name">({song.lead})</span>}
                    </div>
                  ))}
                </div>
              )}
              
              {segment.data?.ministry_leader && (
                <div className="pdf-detail pdf-ministry">
                  Ministración: <span className="pdf-name">{segment.data.ministry_leader}</span>
                  <span className="pdf-duration"> (5 min)</span>
                  {isRight && segment.data?.translator && ` / traduce: ${segment.data.translator}`}
                </div>
              )}
              
              {segment.data?.presenter && !segment.data?.ministry_leader && (
                <div className="pdf-detail">
                  <span className="pdf-name">{segment.data.presenter}</span>
                </div>
              )}
              
              {segment.data?.preacher && (
                <div className="pdf-detail">
                  <span className="pdf-name">{segment.data.preacher}</span>
                </div>
              )}
              
              {segment.data?.title && (
                <div className="pdf-detail pdf-message-title">
                  {segment.data.title}
                </div>
              )}
              
              {segment.data?.verse && (
                <div className="pdf-note">{segment.data.verse}</div>
              )}
              
              {segment.actions?.length > 0 && (
                <div className="pdf-actions">
                  {segment.actions.map((action, aIdx) => (
                    <div key={aIdx} className="pdf-action-item">
                      {action.label}
                      {action.timing === "before_end" && ` (${action.offset_min}m antes)`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="pdf-page pdf-page-1">
      {/* Header - fixed size */}
      <div className="pdf-header">
        <img src={LOGO_URL} alt="Logo" className="pdf-logo" />
        <div className="pdf-header-content">
          <h1 className="pdf-title">ORDEN DE SERVICIO</h1>
          <p className="pdf-date">
            Domingo {formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}
          </p>
          <div className="pdf-roles">
            <span><strong>Coordinador:</strong> {serviceData?.coordinators?.["9:30am"] || serviceData?.coordinators?.["11:30am"] || "—"}</span>
            <span className="pdf-role-sep">/</span>
            <span><strong>Ujier:</strong> {serviceData?.ujieres?.["9:30am"] || serviceData?.ujieres?.["11:30am"] || "—"}</span>
            <span className="pdf-role-sep">/</span>
            <span><strong>Sonido:</strong> {serviceData?.sound?.["9:30am"] || "—"}</span>
            <span className="pdf-role-sep">/</span>
            <span><strong>Luces:</strong> {serviceData?.luces?.["9:30am"] || serviceData?.luces?.["11:30am"] || "—"}</span>
          </div>
        </div>
      </div>
      
      {/* Two Column Grid - scalable content */}
      <div className="pdf-two-columns" style={{ fontSize: `${10.5 * fontScale}pt` }}>
        {renderServiceColumn("9:30am", false)}
        {renderServiceColumn("11:30am", true)}
      </div>
      
      {/* Receso */}
      <div className="pdf-receso">
        <div className="pdf-receso-line" />
        <span>11:00 A.M. — 11:30 A.M. • RECESO</span>
        <div className="pdf-receso-line" />
      </div>
      
      {/* Footer */}
      <div className="pdf-footer">
        ¡Atrévete a cambiar!
      </div>
    </div>
  );
}