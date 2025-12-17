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
  
  // Get all selected announcements in order
  const allAnnouncements = [...fixedAnnouncements, ...dynamicAnnouncements]
    .filter(ann => selectedAnnouncements.includes(ann.id));
  
  // Split into two columns for balanced layout
  const midpoint = Math.ceil(allAnnouncements.length / 2);
  const leftColumn = allAnnouncements.slice(0, midpoint);
  const rightColumn = allAnnouncements.slice(midpoint);
  
  const renderAnnouncement = (ann, idx) => {
    const title = ann.isEvent ? ann.name : ann.title;
    const content = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;
    const date = ann.date_of_occurrence || ann.start_date;
    const endDate = ann.end_date;
    const instructions = ann.instructions;
    
    return (
      <div key={ann.id} className="pdf-announcement">
        <div className="pdf-announcement-header">
          <span className="pdf-announcement-title">{title}</span>
          {date && (
            <span className="pdf-announcement-date">
              {date}{endDate && ` — ${endDate}`}
            </span>
          )}
        </div>
        <div className="pdf-announcement-content">
          {content}
        </div>
        {instructions && (
          <div className="pdf-announcement-cue">
            <span className="pdf-cue-label">CUE:</span> {instructions}
          </div>
        )}
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
      
      {/* Two Column Announcements - scalable content */}
      <div className="pdf-announcements-grid" style={{ fontSize: `${10 * fontScale}pt` }}>
        <div className="pdf-announcements-column">
          {leftColumn.map((ann, idx) => renderAnnouncement(ann, idx))}
        </div>
        <div className="pdf-announcements-column">
          {rightColumn.map((ann, idx) => renderAnnouncement(ann, idx + midpoint))}
        </div>
      </div>
      
      {/* Footer */}
      <div className="pdf-footer">
        ¡Atrévete a cambiar!
      </div>
    </div>
  );
}