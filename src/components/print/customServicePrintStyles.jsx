/**
 * customServicePrintStyles.js
 * Phase 3C extraction: All print-specific CSS for CustomServiceBuilder.
 * Verbatim extraction — zero logic changes.
 * Returns a CSS string to be injected via <style> tag.
 */

export const CUSTOM_SERVICE_PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@media print {
  @page { 
    size: letter; 
    margin: 0;
  }
  
  body { 
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact;
    font-family: 'Inter', Helvetica, Arial, sans-serif;
    background: white;
    font-size: 10.5pt;
    line-height: 1.3;
    color: #374151;
  }

  .print-page-1-wrapper {
    padding: var(--print-margin-top) var(--print-margin-right) calc(var(--print-margin-bottom) + 24pt) var(--print-margin-left);
  }

  .print-page-2-wrapper {
    padding: var(--print-margin-top) var(--print-margin-right) calc(var(--print-margin-bottom) + 24pt) var(--print-margin-left);
  }

  .print-body-content {
    transform: scale(1.0);
    transform-origin: top left;
  }

  .print-announcements-body {
    transform: scale(1.0);
    transform-origin: top left;
  }
  
  * {
    background: white !important;
  }

  .print-header {
    position: relative;
    text-align: center;
    margin-bottom: 14pt;
    padding-bottom: 8pt;
    border-bottom: 1pt solid #e5e7eb;
  }

  .print-logo {
    position: absolute;
    left: 0;
    top: 0;
    width: 50px;
    height: 50px;
  }

  .print-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .print-title {
    text-align: center;
    padding: 0 60px;
  }

  .print-title h1 {
    font-size: 18pt;
    font-weight: 600;
    margin: 0 0 4pt 0;
    text-transform: uppercase;
    color: #000000;
    letter-spacing: 0.5px;
  }

  .print-title p {
    font-size: 11pt;
    color: #4b5563;
    font-weight: 400;
    margin: 0 0 8pt 0;
  }

  .print-team-info {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4pt;
    flex-wrap: wrap;
    font-size: 9pt;
    color: #4b5563;
  }

  .print-team-label {
    font-weight: 600;
    color: #1f2937;
  }

  .print-segment {
    margin-bottom: var(--print-segment-margin);
    padding-bottom: 8pt;
    border-bottom: 1pt solid #f3f4f6;
    font-size: 10.5pt;
    line-height: var(--print-line-height);
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .print-segment:last-child {
    border-bottom: none;
  }

  .print-segment-time {
    font-weight: 600;
    color: #4b5563;
    font-size: 10.5pt;
    display: inline;
    margin-right: 6pt;
  }

  .print-segment-title {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11pt;
    color: #000000;
    letter-spacing: 0.25px;
    display: inline;
  }

  .print-segment-detail {
    font-size: 10.5pt;
    color: #374151;
    line-height: 1.3;
    margin-top: 2pt;
    padding-left: 4pt;
  }

  .print-name-blue {
    color: #2563eb;
    font-weight: 700;
    font-size: 11pt;
  }

  .print-duration {
    font-size: 10pt;
    font-weight: 400;
    color: #6b7280;
  }

  .print-note-text {
    font-size: 9.5pt;
    color: #6b7280;
    font-style: italic;
  }

  .print-note-general-info {
    background-color: #f0fdf4 !important;
    border-left: 4pt solid #16a34a !important;
    color: #14532d !important;
    font-size: 10pt;
    margin-top: 4pt;
    padding: 4pt 8pt;
    font-style: italic;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-note-projection-team {
    border-left: 3pt solid #2563eb;
    background-color: transparent;
    color: #1e40af;
    font-size: 9pt;
    margin-top: 4pt;
    padding: 2pt 6pt;
  }

  .print-note-sound-team {
    border-left: 3pt solid #dc2626;
    background-color: transparent;
    color: #991b1b;
    font-size: 9pt;
    margin-top: 4pt;
    padding: 2pt 6pt;
  }

  .print-note-ushers-team {
    border-left: 3pt solid #16a34a;
    background-color: transparent;
    color: #14532d;
    font-size: 9pt;
    margin-top: 4pt;
    padding: 2pt 6pt;
  }

  .print-note-translation-team {
    border-left: 3pt solid #9333ea;
    background-color: transparent;
    color: #581c87;
    font-size: 9pt;
    margin-top: 4pt;
    padding: 2pt 6pt;
  }

  .print-note-stage-team {
    border-left: 3pt solid #c026d3;
    background-color: transparent;
    color: #701a75;
    font-size: 9pt;
    margin-top: 4pt;
    padding: 2pt 6pt;
  }

  .print-segment-songs {
    margin-top: 4pt;
    padding-left: 4pt;
    font-size: 10pt;
    line-height: 1.35;
  }

  .print-segment-songs div {
    color: #374151;
  }

  .print-announcements {
    padding-bottom: 28pt;
  }

  .print-announcements-logo {
    position: absolute;
    left: 0;
    top: 0;
    width: 50px;
    height: 50px;
  }

  .print-announcements-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .print-announcements-header {
    position: relative;
    text-align: center;
    margin-bottom: 14pt;
    padding-bottom: 8pt;
    border-bottom: 1pt solid #e5e7eb;
  }

  .print-announcements-title {
    font-size: 18pt;
    font-weight: 600;
    text-transform: uppercase;
    margin: 0 0 4pt 0;
    color: #000000;
    letter-spacing: 0.5px;
  }

  .print-announcements-header p {
    font-size: 11pt;
    font-weight: 400;
    color: #4b5563;
    margin: 0;
  }

  .print-announcement-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20pt;
    margin: 0;
    padding: 0;
  }

  .print-announcements-column-left {
    display: flex;
    flex-direction: column;
    gap: 8pt;
  }

  .print-events-column-right {
    display: flex;
    flex-direction: column;
    gap: 6pt;
    border-left: 2pt solid #e5e7eb;
    padding-left: 12pt;
  }

  .print-events-header {
    font-size: 9pt;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4pt;
    padding-bottom: 4pt;
    border-bottom: 1pt solid #e5e7eb;
  }

  .print-announcement-item {
    margin-bottom: 8pt;
    padding-bottom: 8pt;
    border-bottom: 1pt solid #e5e7eb;
    break-inside: avoid;
    page-break-inside: avoid;
    font-size: 9.5pt;
  }

  .print-announcement-item:last-child {
    border-bottom: none;
  }

  .print-announcement-title {
    font-size: 10pt;
    font-weight: 600;
    color: #000000;
    text-transform: uppercase;
    letter-spacing: 0.25px;
    display: block;
    line-height: 1.25;
  }

  .print-announcement-content {
    font-size: 9.5pt;
    line-height: 1.3;
    color: #374151;
    white-space: pre-wrap;
  }

  .print-announcement-instructions {
    margin-top: 4pt;
    font-size: 8.5pt;
    font-style: italic;
    color: #6b7280;
    padding-left: 6pt;
    border-left: 2pt solid #fbbf24;
    line-height: 1.2;
  }

  .print-announcement-instructions::before {
    content: "CUE: ";
    font-weight: 700;
    font-style: normal;
    color: #1f2937;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.5px;
  }

  .print-event-compact {
    display: flex;
    flex-direction: column;
    padding: 4pt 0;
    border-bottom: 1pt solid #f3f4f6;
  }

  .print-event-compact:last-child {
    border-bottom: none;
  }

  .print-event-compact.print-event-emphasized {
    background: #fef3c7 !important;
    border: 2pt solid #f59e0b !important;
    border-radius: 4pt;
    padding: 4pt 6pt;
    margin-bottom: 4pt;
  }

  .print-event-title {
    font-size: 10pt;
    font-weight: 600;
    color: #16a34a;
    line-height: 1.2;
  }

  .print-event-date {
    font-size: 9pt;
    color: #4b5563;
    font-weight: 500;
    margin-top: 2pt;
  }

  .print-event-content {
    font-size: 9pt;
    color: #374151;
    line-height: 1.3;
    margin-top: 2pt;
    white-space: pre-wrap;
  }

  .print-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 20pt;
    background: linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%) !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white !important;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .print-content {
    padding-bottom: 24pt;
  }
}
`;