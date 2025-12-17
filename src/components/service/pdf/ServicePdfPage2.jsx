import React from "react";
import { format as formatDate } from "date-fns";
import { es } from "date-fns/locale";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png";

export default function ServicePdfPage2({ 
  selectedDate, 
  fixedAnnouncements = [], 
  dynamicAnnouncements = [], 
  selectedAnnouncements = [],
  scale = 100 
}) {
  // Scale affects font size of content only, not page dimensions
  const fontScale = scale / 100;
  
  // Separate fixed (verbose scripts) from dynamic (compact events)
  const selectedFixed = fixedAnnouncements.filter(ann => selectedAnnouncements.includes(ann.id));
  const selectedDynamic = dynamicAnnouncements.filter(ann => selectedAnnouncements.includes(ann.id));
  
  // Left column: fixed announcements (full format with CUE)
  const renderFullAnnouncement = (ann) => {
    const title = ann.isEvent ? ann.name : ann.title;
    const content = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;
    const instructions = ann.instructions;
    
    return (
      <div key={ann.id} className="pdf-announcement">
        <div className="pdf-announcement-header">
          <span className="pdf-announcement-title">{title}</span>
        </div>
        {content && (
          <div className="pdf-announcement-content">
            {content}
          </div>
        )}
        {instructions && (
          <div className="pdf-announcement-cue">
            <span className="pdf-cue-label">CUE:</span> {instructions}
          </div>
        )}
      </div>
    );
  };
  
  // Right column: dynamic events (compact format - title + date only)
  const renderCompactEvent = (ann) => {
    const title = ann.isEvent ? ann.name : ann.title;
    const date = ann.date_of_occurrence || ann.start_date;
    const endDate = ann.end_date;
    // For events, show a brief one-liner if available
    const brief = ann.isEvent 
      ? (ann.theme || ann.location || '') 
      : '';
    
    return (
      <div key={ann.id} className="pdf-event-compact">
        <span className="pdf-event-title">{title}</span>
        {date && (
          <span className="pdf-event-date">
            {date}{endDate && ` — ${endDate}`}
          </span>
        )}
        {brief && <span className="pdf-event-brief">{brief}</span>}
      </div>
    );
  };
  
  return (
    <div className="pdf-page pdf-page-2">
      {/* Header - fixed size */}
      <div className="pdf-header">
        <img src={LOGO_URL} alt="Logo" className="pdf-logo" />
        <div className="pdf-header-content">
          <h1 className="pdf-title">ANUNCIOS</h1>
          <p className="pdf-date">
            Domingo {formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
      </div>
      
      {/* Two Column Layout - scalable content */}
      <div className="pdf-announcements-grid" style={{ fontSize: `${10 * fontScale}pt` }}>
        {/* Left: Full announcements with scripts/CUEs */}
        <div className="pdf-announcements-column">
          {selectedFixed.map(ann => renderFullAnnouncement(ann))}
        </div>
        
        {/* Right: Compact event list */}
        <div className="pdf-events-column">
          <div className="pdf-events-header">Próximos Eventos / Upcoming Events</div>
          {selectedDynamic.map(ann => renderCompactEvent(ann))}
        </div>
      </div>
      
      {/* Footer */}
      <div className="pdf-footer">
        ¡Atrévete a cambiar!
      </div>
    </div>
  );
}