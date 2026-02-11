/**
 * PDF Table Builder — 4-Column Grid with PREP rows
 * 
 * Extracted from generateEventReportsPDFClient.jsx (Phase 3E-3)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 * 
 * Exports:
 *   buildDayTable(session, segments, allRooms)
 */
import { pdfTheme } from '../pdfThemeSystem';
import { buildTimeCell, buildDetailsLeftCell, buildDetailsRightCell } from './cellBuilders';
import { buildNotesCell, buildPrepActionRow } from './sectionBuilders';

export function buildDayTable(session, segments, allRooms = []) {
  const sessionColor = session?.session_color || null;
  
  const headerRow = [
    {
      text: 'HORA',
      bold: true,
      fontSize: pdfTheme.fontSize.sm,
      color: pdfTheme.text.primary,
      alignment: 'center',
      fillColor: pdfTheme.fills.header,
    },
    {
      text: 'DETALLES',
      bold: true,
      fontSize: pdfTheme.fontSize.sm,
      color: pdfTheme.text.primary,
      alignment: 'left',
      colSpan: 2,
      fillColor: pdfTheme.fills.header,
    },
    {},
    {
      text: 'NOTAS POR EQUIPO',
      bold: true,
      fontSize: pdfTheme.fontSize.sm,
      color: pdfTheme.text.primary,
      alignment: 'left',
      fillColor: pdfTheme.fills.header,
    },
  ];

  const rows = [headerRow];

  segments
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(seg => {
      // PREP actions rendered as separate full-width rows BEFORE the segment (matching HTML)
      const prepActions = (Array.isArray(seg.segment_actions) ? seg.segment_actions : []).filter(a => a.timing === 'before_start');
      prepActions.forEach(act => {
        rows.push(buildPrepActionRow(act, seg));
      });

      // Main segment row - pass session color for time cell background
      rows.push([
        buildTimeCell(seg, sessionColor),
        buildDetailsLeftCell(seg, allRooms),
        buildDetailsRightCell(seg),
        buildNotesCell(seg),
      ]);
    });

  return {
    table: {
      widths: [55, '*', 130, 180],
      body: rows,
      headerRows: 1,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25),
      vLineWidth: () => 0.25,
      hLineColor: (i) => i === 1 ? '#9CA3AF' : pdfTheme.borders.color,
      vLineColor: () => pdfTheme.borders.lightColor,
      paddingTop: () => 1,
      paddingBottom: () => 1,
      paddingLeft: () => 2,
      paddingRight: () => 2,
    },
    margin: [0, 0, 0, 2],
  };
}