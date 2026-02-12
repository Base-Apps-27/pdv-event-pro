import React from "react";

/**
 * WeeklyServicePrintCSS — Extracted from WeeklyServiceManager (Phase 3A).
 * Contains all @media print CSS rules for the weekly service page.
 * Accepts dynamic print settings for margins, scaling, and font sizes.
 *
 * Props:
 *   printSettingsPage1 — { globalScale, margins: {top,right,bottom,left}, bodyFontScale, titleFontScale }
 *   printSettingsPage2 — { globalScale, margins: {top,right,bottom,left}, bodyFontScale, titleFontScale }
 */
export default function WeeklyServicePrintCSS({ printSettingsPage1, printSettingsPage2 }) {
  return (
    <style>{`
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
          padding: ${printSettingsPage1.margins.top} ${printSettingsPage1.margins.right} calc(${printSettingsPage1.margins.bottom} + 24pt) ${printSettingsPage1.margins.left};
        }

        .print-page-2-wrapper {
          padding: ${printSettingsPage2.margins.top} ${printSettingsPage2.margins.right} calc(${printSettingsPage2.margins.bottom} + 24pt) ${printSettingsPage2.margins.left};
        }
        
        .print-body-content {
          transform: scale(${printSettingsPage1.globalScale});
          transform-origin: top left;
        }
        
        .print-announcements-body {
          transform: scale(${printSettingsPage2.globalScale});
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

        .print-two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24pt;
          margin-bottom: 0;
        }

        .print-service-column {
          break-inside: avoid;
        }

        .print-service-time {
          font-size: 14pt;
          font-weight: 600;
          color: #000000;
          margin-bottom: 10pt;
          padding-bottom: 6pt;
          border-bottom: 2pt solid #1f2937;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .print-segment {
          margin-bottom: 10pt;
          padding-bottom: 8pt;
          border-bottom: 1pt solid #f3f4f6;
          font-size: calc(10.5pt * ${printSettingsPage1.bodyFontScale});
          line-height: 1.3;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .print-segment:last-child {
          border-bottom: none;
        }

        .print-segment-time {
          font-weight: 600;
          color: #dc2626;
          font-size: 10.5pt;
          display: inline;
          margin-right: 6pt;
        }

        .print-segment-title {
          font-weight: 600;
          text-transform: uppercase;
          font-size: calc(11pt * ${printSettingsPage1.titleFontScale});
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

        .print-name {
          color: #374151;
          font-weight: 700;
          font-size: 11pt;
        }
        
        .print-name-blue {
          color: #2563eb;
          font-weight: 700;
          font-size: 11pt;
        }

        .print-name-purple {
          color: #9333ea;
          font-weight: 700;
          font-size: 11pt;
        }

        .print-name-green {
          color: #2563eb;
          font-weight: 700;
          font-size: 11pt;
        }

        .print-sub-assignment {
          margin-top: 2pt;
          padding-left: 6pt;
          border-left: 3pt solid #d8b4fe;
          color: #6b21a8;
          font-size: 10pt;
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

        /* Coordinator Actions - De-emphasized */
        .print-note-coordinator-actions {
          background-color: #fffdf5;
          border: 1px solid #fef3c7;
          color: #78350f;
          font-size: 8pt;
          margin-top: 4pt;
          padding: 3pt 6pt;
          border-radius: 2pt;
        }

        .print-note-coordinator-actions div {
          font-size: 8pt;
          line-height: 1.2;
          font-style: normal;
        }

        /* General / Pre-Service Notes - Primary Importance */
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

        /* Projection Notes - Role Indicator Only */
        .print-note-projection-team {
          border-left: 3pt solid #2563eb;
          background-color: transparent;
          color: #1e40af;
          font-size: 9pt;
          margin-top: 4pt;
          padding: 2pt 6pt;
        }

        /* Sound Notes - Role Indicator Only */
        .print-note-sound-team {
          border-left: 3pt solid #dc2626;
          background-color: transparent;
          color: #991b1b;
          font-size: 9pt;
          margin-top: 4pt;
          padding: 2pt 6pt;
        }

        /* Ushers Notes */
        .print-note-ushers-team {
          border-left: 3pt solid #16a34a;
          background-color: transparent;
          color: #14532d;
          font-size: 9pt;
          margin-top: 4pt;
          padding: 2pt 6pt;
        }

        /* Translation Notes */
        .print-note-translation-team {
          border-left: 3pt solid #9333ea;
          background-color: transparent;
          color: #581c87;
          font-size: 9pt;
          margin-top: 4pt;
          padding: 2pt 6pt;
        }
        
        /* Stage Notes */
        .print-note-stage-team {
          border-left: 3pt solid #c026d3;
          background-color: transparent;
          color: #701a75;
          font-size: 9pt;
          margin-top: 4pt;
          padding: 2pt 6pt;
        }

        /* Segment-Specific Coordinator Notes - Contextual */
        .print-note-segment-coordinator {
          background-color: #fffbeb;
          border-left: 1px solid #fcd34d;
          color: #92400e;
          font-size: 9pt;
          margin-top: 2pt;
          padding: 2pt 4pt;
          font-style: italic;
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

        .print-receso {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12pt;
          padding: 8pt 0;
          margin: 14pt 0;
          font-size: 11pt;
          font-weight: 600;
          color: #1f2937;
        }

        .print-receso::before,
        .print-receso::after {
          content: '';
          flex: 1;
          height: 1pt;
          background: #d1d5db;
        }

        .print-announcements {
          break-before: page;
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

        .print-event-brief {
          font-size: 8.5pt;
          color: #6b7280;
          font-style: italic;
          margin-top: 1pt;
        }

        .print-announcement-item {
          margin-bottom: 8pt;
          padding-bottom: 8pt;
          border-bottom: 1pt solid #e5e7eb;
          break-inside: avoid;
          page-break-inside: avoid;
          font-size: calc(9.5pt * ${printSettingsPage2.bodyFontScale});
        }

        .print-announcement-item:last-child {
          border-bottom: none;
        }

        .print-announcement-header {
          margin-bottom: 3pt;
        }

        .print-announcement-title {
          font-size: calc(10pt * ${printSettingsPage2.titleFontScale});
          font-weight: 600;
          color: #000000;
          text-transform: uppercase;
          letter-spacing: 0.25px;
          display: block;
          line-height: 1.25;
        }

        .print-announcement-date {
          font-size: 9pt;
          font-weight: 400;
          color: #4b5563;
          display: block;
          margin-top: 2pt;
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

        .print-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: 20pt;
          background: linear-gradient(90deg, #16a34a 0%, #059669 100%) !important;
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
    `}</style>
  );
}