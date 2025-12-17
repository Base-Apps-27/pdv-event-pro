import React from "react";

// US Letter dimensions in pixels at 96 DPI
// 8.5" x 11" = 816px x 1056px
// With 0.5" margins = 48px margins
// Content area = 720px x 960px

export const PDF_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  .pdf-page {
    width: 816px;
    height: 1056px;
    padding: 48px;
    background: white;
    font-family: 'Inter', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.3;
    color: #374151;
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Header */
  .pdf-header {
    position: relative;
    text-align: center;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  }

  .pdf-logo {
    position: absolute;
    left: 0;
    top: 0;
    width: 50px;
    height: 50px;
    object-fit: contain;
  }

  .pdf-header-content {
    padding: 0 60px;
  }

  .pdf-title {
    font-size: 18pt;
    font-weight: 600;
    color: #000000;
    margin: 0 0 4px 0;
    letter-spacing: 0.5px;
  }

  .pdf-date {
    font-size: 11pt;
    color: #4b5563;
    margin: 0 0 8px 0;
  }

  .pdf-roles {
    font-size: 9pt;
    color: #4b5563;
    display: flex;
    justify-content: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .pdf-roles strong {
    color: #1f2937;
  }

  .pdf-role-sep {
    color: #9ca3af;
  }

  /* Two Column Grid */
  .pdf-two-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  /* Service Column */
  .pdf-service-column {
    min-width: 0;
  }

  .pdf-column-header {
    font-size: 1.35em;
    font-weight: 600;
    color: #000000;
    padding-bottom: 0.5em;
    margin-bottom: 0.85em;
    border-bottom: 2px solid #1f2937;
  }

  .pdf-pre-service-note {
    font-size: 0.9em;
    font-style: italic;
    color: #6b7280;
    margin-bottom: 0.85em;
    padding-left: 0.35em;
  }

  /* Segment - all sizes use em so they inherit from parent font-size */
  .pdf-segment {
    margin-bottom: 1em;
    padding-bottom: 0.7em;
    border-bottom: 1px solid #f3f4f6;
  }

  .pdf-segment:last-child {
    border-bottom: none;
  }

  .pdf-segment-header {
    display: flex;
    align-items: baseline;
    gap: 0.5em;
    flex-wrap: wrap;
    margin-bottom: 0.25em;
  }

  .pdf-time {
    font-size: 1em;
    font-weight: 600;
    color: #dc2626;
  }

  .pdf-segment-title {
    font-size: 1.05em;
    font-weight: 600;
    color: #000000;
    text-transform: uppercase;
    letter-spacing: 0.25px;
  }

  .pdf-duration {
    font-size: 0.95em;
    color: #6b7280;
    font-weight: 400;
  }

  .pdf-detail {
    font-size: 1em;
    color: #374151;
    margin-top: 0.15em;
    padding-left: 0.4em;
  }

  .pdf-name {
    color: #16a34a;
    font-weight: 600;
  }

  .pdf-ministry {
    margin-top: 0.35em;
  }

  .pdf-message-title {
    font-style: italic;
  }

  .pdf-note {
    font-size: 0.9em;
    font-style: italic;
    color: #6b7280;
    margin-top: 0.15em;
    padding-left: 0.4em;
  }

  .pdf-songs {
    margin-top: 0.35em;
    padding-left: 0.4em;
  }

  .pdf-song-item {
    font-size: 0.95em;
    color: #374151;
    line-height: 1.4;
  }

  .pdf-actions {
    margin-top: 0.35em;
    padding-left: 0.4em;
  }

  .pdf-action-item {
    font-size: 0.9em;
    font-style: italic;
    color: #6b7280;
  }

  /* Receso */
  .pdf-receso {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 16px 0;
    font-size: 11pt;
    font-weight: 600;
    color: #1f2937;
  }

  .pdf-receso-line {
    flex: 1;
    height: 1px;
    background: #d1d5db;
  }

  /* Footer */
  .pdf-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 24px;
    background: linear-gradient(90deg, #16a34a 0%, #059669 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  /* Page 2 - Announcements */
  .pdf-announcements-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    flex: 1;
  }

  .pdf-announcements-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pdf-announcement {
    padding-bottom: 10px;
    border-bottom: 1px solid #e5e7eb;
  }

  .pdf-announcement:last-child {
    border-bottom: none;
  }

  .pdf-announcement-header {
    margin-bottom: 4px;
  }

  .pdf-announcement-title {
    font-size: 1.05em;
    font-weight: 600;
    color: #000000;
    text-transform: uppercase;
    letter-spacing: 0.25px;
    display: block;
    line-height: 1.3;
  }

  .pdf-announcement-date {
    font-size: 0.95em;
    color: #4b5563;
    display: block;
    margin-top: 0.15em;
  }

  .pdf-announcement-content {
    font-size: 1em;
    color: #374151;
    line-height: 1.35;
    white-space: pre-wrap;
  }

  .pdf-announcement-cue {
    margin-top: 0.5em;
    font-size: 0.9em;
    font-style: italic;
    color: #6b7280;
    padding-left: 0.4em;
    border-left: 2px solid #fbbf24;
  }

  .pdf-cue-label {
    font-weight: 700;
    font-style: normal;
    color: #1f2937;
    text-transform: uppercase;
    font-size: 0.8em;
    letter-spacing: 0.5px;
  }

  /* Right Column - Compact Events List */
  .pdf-events-column {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    border-left: 2px solid #e5e7eb;
    padding-left: 12px;
  }

  .pdf-events-header {
    font-size: 0.9em;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #e5e7eb;
  }

  /* Dynamic Event - Full Format */
  .pdf-dynamic-event {
    display: flex;
    flex-direction: column;
    padding: 0.5em 0;
    border-bottom: 1px solid #e5e7eb;
  }

  .pdf-dynamic-event:last-child {
    border-bottom: none;
  }

  .pdf-dynamic-event.pdf-emphasized {
    background: #fef3c7;
    border: 2px solid #f59e0b;
    border-radius: 4px;
    padding: 0.5em;
    margin-bottom: 0.5em;
  }

  .pdf-dynamic-event-header {
    margin-bottom: 0.25em;
  }

  .pdf-event-title {
    font-size: 1em;
    font-weight: 600;
    color: #16a34a;
    line-height: 1.2;
    display: block;
  }

  .pdf-event-date {
    font-size: 0.85em;
    color: #4b5563;
    font-weight: 500;
    margin-top: 0.15em;
    display: block;
  }

  .pdf-dynamic-event-content {
    font-size: 0.9em;
    color: #374151;
    line-height: 1.3;
    white-space: pre-wrap;
    margin-top: 0.25em;
  }

  .pdf-event-brief {
    font-size: 0.85em;
    color: #6b7280;
    font-style: italic;
    margin-top: 0.1em;
  }

  /* Preview container styles */
  .pdf-preview-container {
    background: #e5e7eb;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 600px;
    overflow: auto;
  }

  .pdf-preview-page-wrapper {
    position: relative;
    background: white;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  }

  .pdf-preview-safe-area {
    position: absolute;
    top: 48px;
    left: 48px;
    right: 48px;
    bottom: 48px;
    border: 1px dashed #3b82f6;
    pointer-events: none;
    opacity: 0.5;
  }

  .pdf-preview-overflow-indicator {
    position: absolute;
    bottom: 48px;
    left: 48px;
    right: 48px;
    height: 2px;
    background: #dc2626;
  }
`;

export default function PdfStyles() {
  return <style>{PDF_STYLES}</style>;
}