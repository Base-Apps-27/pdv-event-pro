/**
 * WeeklyServicePrintView
 * 
 * Phase 3B extraction from WeeklyServiceManager.
 * Contains all print-specific CSS and the 2-page print HTML layout:
 *   Page 1: Service Program (two-column: 9:30 AM / 11:30 AM)
 *   Page 2: Announcements (two-column: Fixed / Dynamic)
 * 
 * This component renders ONLY inside @media print — hidden on screen.
 * All data is read-only props from the parent.
 */
import React from "react";
import { addMinutes, parse, format as formatDate } from "date-fns";
import { es } from "date-fns/locale";

// Logo URL constant (same as used in WeeklyServiceManager)
const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png";

/**
 * Sanitize HTML for print — only allow safe inline tags
 */
function sanitizeHTML(html) {
  if (!html) return '';
  return html
    .replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Renders the print-only segment detail block for a single segment.
 * Used for both 9:30am and 11:30am columns.
 */
function PrintSegment({ segment, segmentTime, showTranslationLine = false }) {
  const presenterHasTranslation = /(trad|traduc)/i.test(segment.data?.presenter || '');
  const preacherHasTranslation = /(trad|traduc)/i.test(segment.data?.preacher || '');

  return (
    <div className="print-segment">
      <div>
        <span className="print-segment-time">{segmentTime}</span>
        <span className="print-segment-title">{segment.title}</span>
        {segment.duration && <span className="print-duration"> ({segment.duration} mins)</span>}
      </div>

      {/* Leader */}
      {segment.data?.leader && (
        <div className="print-segment-detail">
          Dirige: <span className="print-name-blue">{segment.data.leader.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
        </div>
      )}

      {/* Leader translation line (11:30 only) */}
      {showTranslationLine && segment.data?.leader && segment.requires_translation && segment.data?.translator && (
        <div className="print-segment-detail print-note-text" style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2pt' }}>
          🌐 Traduce: {segment.data.translator}
        </div>
      )}

      {/* Songs */}
      {segment.songs && segment.songs.filter(s => s.title).length > 0 && (
        <div className="print-segment-songs">
          {segment.songs.filter(s => s.title).map((song, sIdx) => (
            <div key={sIdx}>- {song.title} {song.lead && `(${song.lead})`}</div>
          ))}
        </div>
      )}

      {/* Sub-assignments */}
      {segment.sub_assignments && segment.sub_assignments.map((subAssign, saIdx) => {
        const personValue = segment.data?.[subAssign.person_field_name];
        if (!personValue) return null;
        return (
          <div key={saIdx} className="print-sub-assignment">
            <strong>{subAssign.label}:</strong> <span className="print-name-purple">{personValue}</span>
            {subAssign.duration_min && <span className="print-duration"> ({subAssign.duration_min} min)</span>}
          </div>
        );
      })}

      {/* Legacy ministry_leader fallback */}
      {(!segment.sub_assignments || segment.sub_assignments.length === 0) && segment.data?.ministry_leader && (
        <div className="print-sub-assignment">
          <strong>Ministración:</strong> <span className="print-name-purple">{segment.data.ministry_leader}</span> <span className="print-duration">(5 min)</span>
        </div>
      )}

      {/* Preacher */}
      {segment.data?.preacher && (
        <div className="print-segment-detail">
          <span className="print-name-blue">{segment.data.preacher.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
        </div>
      )}

      {/* Preacher translation line */}
      {segment.data?.preacher && segment.requires_translation && segment.data?.translator && !preacherHasTranslation && (
        <div className="print-segment-detail print-note-text" style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2pt' }}>
          🌐 Traduce: {segment.data.translator}
        </div>
      )}

      {/* Cierre sub-assignment */}
      {segment.sub_assignments && segment.sub_assignments.filter(sa => sa.person_field_name === 'cierre_leader').map((subAssign, saIdx) => {
        const personValue = segment.data?.[subAssign.person_field_name];
        if (!personValue) return null;
        return (
          <div key={`cierre-${saIdx}`} className="print-sub-assignment">
            <strong>{subAssign.label}:</strong> <span className="print-name-purple">{personValue}</span>
            {subAssign.duration_min && <span className="print-duration"> ({subAssign.duration_min} min)</span>}
          </div>
        );
      })}

      {/* Presenter (only if no other roles shown) */}
      {segment.data?.presenter && !segment.data?.ministry_leader && !segment.data?.preacher && !segment.data?.leader && (
        <div className="print-segment-detail">
          <span className="print-name-blue">{segment.data.presenter.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '')}</span>
        </div>
      )}

      {/* Presenter translation line */}
      {segment.data?.presenter && !segment.data?.ministry_leader && !segment.data?.preacher && !segment.data?.leader &&
       segment.requires_translation && segment.data?.translator && !presenterHasTranslation && (
        <div className="print-segment-detail print-note-text" style={{ fontSize: '9pt', color: '#6b7280', marginTop: '2pt' }}>
          🌐 Traduce: {segment.data.translator}
        </div>
      )}

      {/* Message title */}
      {segment.data?.title && (
        <div className="print-segment-detail">{segment.data.title}</div>
      )}

      {/* Verse */}
      {segment.data?.verse && (
        <div className="print-segment-detail print-note-text">{segment.data.verse}</div>
      )}

      {/* Description */}
      {segment.data?.description && (
        <div className="print-note-general-info">{segment.data.description}</div>
      )}

      {/* Description details */}
      {segment.data?.description_details && (
        <div className="print-note-general-info">
          {!showTranslationLine && <strong>📝 Notas:</strong>} {segment.data.description_details}
        </div>
      )}

      {/* Department notes */}
      {segment.data?.projection_notes && (
        <div className="print-note-projection-team"><strong>📽️ Proyección:</strong> {segment.data.projection_notes}</div>
      )}
      {segment.data?.sound_notes && (
        <div className="print-note-sound-team"><strong>🔊 Sonido:</strong> {segment.data.sound_notes}</div>
      )}
      {segment.data?.ushers_notes && (
        <div className="print-note-ushers-team"><strong>🚪 Ujieres:</strong> {segment.data.ushers_notes}</div>
      )}
      {segment.data?.translation_notes && (
        <div className="print-note-translation-team"><strong>🌐 Traducción:</strong> {segment.data.translation_notes}</div>
      )}
      {segment.data?.stage_decor_notes && (
        <div className="print-note-stage-team"><strong>🎨 Stage:</strong> {segment.data.stage_decor_notes}</div>
      )}
      {segment.data?.coordinator_notes && (
        <div className="print-note-segment-coordinator"><strong>📋 Coordinador:</strong> {segment.data.coordinator_notes}</div>
      )}

      {/* Coordinator actions */}
      {segment.actions && segment.actions.length > 0 && (
        <div className="print-note-coordinator-actions">
          {segment.actions.map((action, aIdx) => {
            const safeAction = typeof action === 'object' && action !== null ? action : {};
            const hasTimingInLabel = /\d+\s*min/i.test(safeAction.label || '');
            return (
              <div key={aIdx}>
                {safeAction.label || ''}
                {!hasTimingInLabel && safeAction.timing === "before_end" && ` (${safeAction.offset_min || 0} min antes)`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Calculates segment time for a given time slot and index.
 */
function calculateSegmentTime(segments, timeSlotStr, idx) {
  let currentTime = parse(timeSlotStr, "h:mma", new Date());
  for (let i = 0; i < idx; i++) {
    if (segments[i].type !== 'break' && segments[i].type !== 'ministry') {
      currentTime = addMinutes(currentTime, segments[i].duration || 0);
    }
  }
  return formatDate(currentTime, "h:mm a");
}

export default function WeeklyServicePrintView({
  serviceData,
  selectedDate,
  fixedAnnouncements,
  dynamicAnnouncements,
  selectedAnnouncements,
  printSettingsPage1,
  printSettingsPage2,
  isQuickPrint = false,
  slotNames, // Entity Lift: dynamic slot names from ServiceSchedule
}) {
  if (!serviceData) return null;

  const defaultPrintSettings = {
    globalScale: 1.0,
    margins: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    bodyFontScale: 1.0,
    titleFontScale: 1.0
  };

  const activePrintSettingsPage1 = isQuickPrint ? defaultPrintSettings : (printSettingsPage1 || defaultPrintSettings);
  const activePrintSettingsPage2 = isQuickPrint ? defaultPrintSettings : (printSettingsPage2 || defaultPrintSettings);

  // Entity Lift: Dynamic slots. Falls back to legacy hardcoded if not provided.
  const slots = (slotNames && slotNames.length > 0) ? slotNames : ["9:30am", "11:30am"];
  const firstSlot = slots[0];
  const secondSlot = slots.length > 1 ? slots[1] : null;

  return (
    <div className="hidden print:block">
      {/* Print-specific CSS — Phase 3B: extracted from WeeklyServiceManager inline <style> */}
      <style>{`
        @media print {
          .print-page-1-wrapper {
            padding: ${activePrintSettingsPage1.margins.top} ${activePrintSettingsPage1.margins.right} calc(${activePrintSettingsPage1.margins.bottom} + 24pt) ${activePrintSettingsPage1.margins.left};
          }
          .print-page-2-wrapper {
            padding: ${activePrintSettingsPage2.margins.top} ${activePrintSettingsPage2.margins.right} calc(${activePrintSettingsPage2.margins.bottom} + 24pt) ${activePrintSettingsPage2.margins.left};
          }
          .print-body-content {
            transform: scale(${activePrintSettingsPage1.globalScale});
            transform-origin: top left;
          }
          .print-announcements-body {
            transform: scale(${activePrintSettingsPage2.globalScale});
            transform-origin: top left;
          }
          .print-segment {
            font-size: calc(10.5pt * ${activePrintSettingsPage1.bodyFontScale});
          }
          .print-segment-title {
            font-size: calc(11pt * ${activePrintSettingsPage1.titleFontScale});
          }
          .print-announcement-item {
            font-size: calc(9.5pt * ${activePrintSettingsPage2.bodyFontScale});
          }
          .print-announcement-title {
            font-size: calc(10pt * ${activePrintSettingsPage2.titleFontScale});
          }
        }
      `}</style>

      {/* PAGE 1: Service Program */}
      <div className="print-page-1-wrapper">
        <div className="print-header" style={{ position: 'relative' }}>
          <div className="print-logo" style={{ position: 'absolute', left: '0', top: '0' }}>
            <img src={LOGO_URL} alt="Logo" />
          </div>
          <div className="print-title">
            <h1>Orden de Servicio</h1>
            <p>Domingo {formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</p>
            <div className="print-team-info">
              <span><span className="print-team-label">Coordinador:</span> {serviceData?.coordinators?.["9:30am"] || serviceData?.coordinators?.["11:30am"] || "—"}</span>
              <span style={{ color: '#9ca3af' }}>/</span>
              <span><span className="print-team-label">Ujier:</span> {serviceData?.ujieres?.["9:30am"] || serviceData?.ujieres?.["11:30am"] || "—"}</span>
              <span style={{ color: '#9ca3af' }}>/</span>
              <span><span className="print-team-label">Sonido:</span> {serviceData?.sound?.["9:30am"] || "—"}</span>
              <span style={{ color: '#9ca3af' }}>/</span>
              <span><span className="print-team-label">Luces:</span> {serviceData?.luces?.["9:30am"] || serviceData?.luces?.["11:30am"] || "—"}</span>
              <span style={{ color: '#9ca3af' }}>/</span>
              <span><span className="print-team-label">Foto:</span> {serviceData?.fotografia?.["9:30am"] || serviceData?.fotografia?.["11:30am"] || "—"}</span>
            </div>
          </div>
        </div>

        <div className="print-body-content">
          <div className="print-two-columns">
            {/* Left Column: 9:30 AM */}
            <div className="print-service-column left">
              <div className="print-service-time">9:30 A.M.</div>
              {serviceData?.pre_service_notes?.["9:30am"] && (
                <div className="print-segment">
                  <div className="print-note-general-info">{serviceData.pre_service_notes["9:30am"]}</div>
                </div>
              )}
              {filteredSegments930.map((segment, idx) => (
                <PrintSegment
                  key={idx}
                  segment={segment}
                  segmentTime={calculateSegmentTime(segments930, "9:30am", idx)}
                  showTranslationLine={false}
                />
              ))}
            </div>

            {/* Right Column: 11:30 AM */}
            <div className="print-service-column right">
              <div className="print-service-time">11:30 A.M.</div>
              {serviceData?.pre_service_notes?.["11:30am"] && (
                <div className="print-segment">
                  <div className="print-note-general-info">{serviceData.pre_service_notes["11:30am"]}</div>
                </div>
              )}
              {filteredSegments1130.map((segment, idx) => (
                <PrintSegment
                  key={idx}
                  segment={segment}
                  segmentTime={calculateSegmentTime(segments1130, "11:30am", idx)}
                  showTranslationLine={true}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="print-receso">
          11:00 A.M. — 11:30 A.M. • RECESO
          {serviceData?.receso_notes?.["9:30am"] && (
            <span style={{ fontSize: '9pt', fontWeight: 400, marginLeft: '8pt', fontStyle: 'italic', color: '#6b7280' }}>
              ({serviceData.receso_notes["9:30am"]})
            </span>
          )}
        </div>
      </div>

      {/* PAGE 2: Announcements */}
      <div className="print-page-2-wrapper">
        <div className="print-announcements">
          <div className="print-announcements-header" style={{ position: 'relative' }}>
            <div className="print-announcements-logo" style={{ position: 'absolute', left: '0', top: '0' }}>
              <img src={LOGO_URL} alt="Logo" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="print-announcements-title">ANUNCIOS</div>
              <p>Domingo {formatDate(new Date(selectedDate + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</p>
            </div>
          </div>

          <div className="print-announcements-body">
            <div className="print-announcement-list">
              {/* Left Column: Fixed announcements */}
              <div className="print-announcements-column-left">
                {fixedAnnouncements
                  .filter(ann => selectedAnnouncements.includes(ann.id))
                  .map((ann) => (
                    <div key={ann.id} className="print-announcement-item">
                      <div className="print-announcement-header">
                        <div className="print-announcement-title">{ann.title}</div>
                      </div>
                      {ann.content && (
                        <div className="print-announcement-content" dangerouslySetInnerHTML={{ __html: sanitizeHTML(ann.content) }} />
                      )}
                      {ann.instructions && (
                        <div className="print-announcement-instructions" dangerouslySetInnerHTML={{ __html: sanitizeHTML(ann.instructions) }} />
                      )}
                    </div>
                  ))}
              </div>

              {/* Right Column: Dynamic events */}
              <div className="print-events-column-right">
                <div className="print-events-header">Próximos Eventos / Upcoming Events</div>
                {dynamicAnnouncements
                  .filter(ann => selectedAnnouncements.includes(ann.id))
                  .map((ann) => {
                    const content = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;
                    const isEmphasized = ann.emphasize || ann.category === 'Urgent';
                    return (
                      <div key={ann.id} className={`print-event-compact ${isEmphasized ? 'print-event-emphasized' : ''}`}>
                        <div className="print-event-title">{ann.isEvent ? ann.name : ann.title}</div>
                        {(ann.date_of_occurrence || ann.start_date) && (
                          <div className="print-event-date">
                            {ann.date_of_occurrence || ann.start_date}
                            {ann.end_date && ` — ${ann.end_date}`}
                          </div>
                        )}
                        {content && (
                          <div className="print-event-content" dangerouslySetInnerHTML={{ __html: sanitizeHTML(content) }} />
                        )}
                        {ann.instructions && (
                          <div className="print-announcement-instructions" dangerouslySetInnerHTML={{ __html: sanitizeHTML(ann.instructions) }} />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="print-footer">
        ¡Atrévete a cambiar!
      </div>
    </div>
  );
}