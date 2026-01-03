/**
 * Dedicated Print Styles for Print Pages
 * 
 * CRITICAL: These styles are ONLY applied to dedicated print pages (/print/program, /print/announcements)
 * NOT to the main application. This isolation prevents CSS conflicts and ensures Safari reliability.
 * 
 * DESIGN RULE: Do NOT modify visual appearance. These styles enforce print correctness only.
 */

@media print {
  /* Page Setup - Letter Size, Zero Margins (we control via component) */
  @page {
    size: letter;
    margin: 0 !important;
  }

  /* Reset Body - Critical for Safari */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 8.5in;
    height: auto !important;
    overflow: visible !important;
    background: white !important;
  }

  /* Ensure Brand Colors Print (Safari requires explicit declaration) */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Hide All Non-Print Elements */
  body > *:not(.print-page-root) {
    display: none !important;
  }

  /* Ensure Print Page is Visible */
  .print-page-root {
    display: block !important;
    position: relative !important;
    width: 8.5in !important;
    height: 11in !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    page-break-after: avoid !important;
    page-break-inside: avoid !important;
    break-after: avoid !important;
    break-inside: avoid !important;
  }

  /* Prevent Extra Blank Pages (Safari Bug Mitigation) */
  .print-page-root * {
    max-height: none !important; /* Remove any max-height constraints */
  }

  /* Ensure No Trailing Elements Cause Page Breaks */
  .print-page-root::after {
    content: none !important;
  }

  /* Force Overflow Visible (no scrollbars in print) */
  * {
    overflow: visible !important;
  }

  /* Prevent Page Breaks Within Segments */
  .print-segment {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* Ensure Footer Prints Correctly */
  .print-footer {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    background-color: #1F8A70 !important;
    background-image: linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%) !important;
    color: white !important;
  }

  /* Ensure Logo Prints */
  .print-logo img {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Hide Loading Messages */
  .print-loading {
    display: none !important;
  }
}

/* Screen Styles for Print Pages (Loading State) */
@media screen {
  .print-page-root {
    display: block;
    width: 8.5in;
    margin: 0 auto;
    background: white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .print-loading {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.8);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 600;
    z-index: 9999;
  }
}