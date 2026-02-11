/**
 * Report Print CSS
 * 
 * Extracted from pages/Reports.jsx (Phase 3D-4)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 */
export const REPORT_PRINT_CSS = `
  @media print {
    @page {
      size: letter landscape;
      margin: 0.5cm;
    }
    body * {
      visibility: hidden;
    }
    #printable-report, #printable-report * {
      visibility: visible;
    }
    #printable-report {
      position: relative;
      width: 100%;
      padding: 0;
      background: white;
    }
    
    .print-header {
      display: flex !important;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #e5e7eb;
      page-break-after: avoid;
      break-after: avoid;
    }
    
    .print-logo {
      width: 35px;
      height: 35px;
      flex-shrink: 0;
    }
    
    .print-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .print-title {
      flex: 1;
    }
    
    .print-title h1 {
      font-size: 14pt;
      font-weight: bold;
      color: #1a1a1a;
      margin: 0;
      line-height: 1.1;
    }
    
    .print-title p {
      font-size: 9pt;
      color: #1F8A70;
      font-style: italic;
      margin: 0;
      line-height: 1.1;
    }
    .no-print {
      display: none !important;
    }
    .print-session {
      break-inside: avoid;
      page-break-inside: avoid;
      display: block;
      width: 100%;
      margin-bottom: 8px !important;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
    }

    /* Force new page before every session except the first one */
    .print-session:not(:first-of-type) {
      break-before: page;
      page-break-before: always;
    }
    
    /* Optimization for print density */
    .print-session table {
      width: 100%;
    }
    .print-session th, .print-session td {
      padding: 2px 4px !important;
      vertical-align: top !important;
    }
    .print-session .text-xl {
      font-size: 14px !important;
      line-height: 1.2;
    }
    .print-session .text-lg {
      font-size: 12px !important;
    }
    .print-session .text-xs {
      font-size: 10px !important;
    }
    .print-session .text-\\[10px\\] {
      font-size: 9px !important;
    }
    
    /* Tighten up spacing */
    .print-session .p-2 {
      padding: 0.25rem !important;
    }
    .print-session .gap-2 {
      gap: 0.25rem !important;
    }
    .print-session .mb-4 {
      margin-bottom: 0.5rem !important;
    }

    /* Print All Reports mode */
    .print-all-reports {
      display: block !important;
    }
    .print-all-reports .print-section {
      break-before: page;
      page-break-before: always;
    }
    .print-all-reports .print-section:first-child {
      break-before: auto;
      page-break-before: auto;
    }
  }
`;