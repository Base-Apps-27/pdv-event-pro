/**
 * PDF Generator with Heuristic Scaling + Cache
 * 
 * Strategy:
 * 1. Check localStorage cache by service data hash → instant return if hit
 * 2. If miss: estimate optimal scale using content heuristics
 * 3. Generate PDF once at calculated scale
 * 4. Cache result for 48h
 * 
 * Why heuristics over iteration?
 * - pdfmake doesn't expose page count before rendering (async layout)
 * - Heuristic is fast, predictable, and tunable based on real-world feedback
 * - Single-pass generation (no expensive re-renders)
 * 
 * Performance:
 * - First PDF: 2–3 seconds (single generation)
 * - Cached PDF: <100ms (localStorage retrieval)
 */

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getLogoDataUrl } from './pdfLogoData';
import { getCachedPDF, cachePDF } from './pdfCacheManager';
pdfMake.vfs = pdfFonts.vfs;

import { buildTeamInfo, buildSegments, formatDate, estimateOptimalScale } from './generateProgramPDF';

/**
 * Main entry point: generate service program PDF with heuristic scaling
 * Returns { pdf, isCached, scale }
 */
export async function generateServiceProgramPDFWithAutoFit(serviceData, onProgress) {
  console.log('[PDF] Starting PDF generation with heuristic scaling...');
  
  // Pre-calculate scale to include in cache key (ensures cache invalidates when scaling heuristic changes)
  const preCalculatedScale = estimateOptimalScale(serviceData);
  
  // Check cache first
  const cached = await getCachedPDF(serviceData);
  if (cached) {
    // Only use cache if the scale matches current heuristic
    // This prevents serving stale PDFs if the heuristic logic changes
    const cachedScale = cached.metadata?.scale || 1.0;
    if (Math.abs(cachedScale - preCalculatedScale) < 0.01) {
      console.log('[PDF] Cache hit - returning cached PDF');
      return {
        pdf: cached.blob,
        isCached: true,
        scale: cachedScale
      };
    } else {
      console.log(`[PDF] Cache scale mismatch (cached: ${cachedScale.toFixed(2)}, current: ${preCalculatedScale.toFixed(2)}) - regenerating`);
    }
  }
  
  if (onProgress) {
    onProgress('Generando PDF...');
  }
  
  const logoDataUrl = await getLogoDataUrl();
  
  // Use proven heuristic to estimate optimal scale
  const globalScale = estimateOptimalScale(serviceData);
  console.log(`[PDF] Heuristic scale: ${globalScale.toFixed(2)}`);
  
  // Generate PDF once at calculated scale
  const pdfDoc = buildServiceProgramDocument(
    serviceData,
    logoDataUrl,
    globalScale
  );
  
  // Generate final PDF blob
  const pdfBlob = await new Promise((resolve, reject) => {
    try {
      pdfDoc.getBase64((pdf) => {
        const binaryStr = atob(pdf);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        resolve(new Blob([bytes], { type: 'application/pdf' }));
      });
    } catch (err) {
      reject(err);
    }
  });
  
  // Cache result
  await cachePDF(serviceData, pdfBlob, {
    scale: globalScale
  });
  
  console.log('[PDF] Generation complete');
  
  return {
    pdf: pdfBlob,
    isCached: false,
    scale: globalScale
  };
}

/**
 * Build the PDF document with specified scale
 */
function buildServiceProgramDocument(serviceData, logoDataUrl, globalScale) {
  // Brand Palette from Guide
  const BRAND = {
    BLACK: '#1A1A1A',     // Charcoal/Black
    TEAL: '#1F8A70',      // Primary Teal
    GREEN: '#8DC63F',     // Bright Green
    LIME: '#D7DF23',      // Lime Yellow
    WHITE: '#FFFFFF',
    GRAY: '#4B5563',
    LIGHT_GRAY: '#E5E7EB'
  };

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [36, 48, 36, 56], // Increased top margin slightly for brand bar
    
    // Background Header Bar (Brand Gradient)
    background: function(currentPage, pageSize) {
      if (currentPage === 1) {
        return {
          canvas: [
            {
              type: 'rect',
              x: 0, y: 0, w: pageSize.width, h: 12,
              linearGradient: [BRAND.TEAL, BRAND.GREEN, BRAND.LIME]
            }
          ]
        };
      }
      return null;
    },

    content: [
      // Logo + Title Header
      {
        columns: [
          logoDataUrl ? {
            width: 60,
            image: logoDataUrl,
            fit: [60, 60],
            alignment: 'left'
          } : { width: 60, text: '' },
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: [
              {
                text: (serviceData.name || 'ORDEN DE SERVICIO').toUpperCase(),
                fontSize: 22 * globalScale, // Larger, bolder
                bold: true,
                alignment: 'center',
                color: BRAND.BLACK,
                characterSpacing: 0.5,
                margin: [0, 4, 0, 2]
              },
              {
                text: `${serviceData.day_of_week} ${formatDate(serviceData.date)}${serviceData.time ? ` • ${serviceData.time}` : ''}`.toUpperCase(),
                fontSize: 10 * globalScale,
                bold: true,
                alignment: 'center',
                color: BRAND.TEAL,
                characterSpacing: 1,
                margin: [0, 0, 0, 4]
              }
            ]
          },
          { width: '*', text: '' },
          { width: 60, text: '' }
        ],
        margin: [0, 0, 0, 12]
      },
      
      // Team info
      ...(buildTeamInfo(serviceData, globalScale).length > 0 ? [{
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: buildTeamInfo(serviceData, globalScale)
          },
          { width: '*', text: '' }
        ],
        margin: [0, 0, 0, 12]
      }] : []),
      
      // Divider (Brand Colors)
      { 
        canvas: [{ 
          type: 'line', 
          x1: 0, y1: 0, x2: 540, y2: 0, 
          lineWidth: 2, 
          lineColor: BRAND.GREEN // Green accent line
        }], 
        margin: [0, 0, 0, 16] 
      },
      
      // Segments
      ...buildSegments(serviceData.segments || [], globalScale, globalScale)
    ],
    
    // Brand Footer: Charcoal Background + Gradient Top Border
    footer: (currentPage, pageCount) => ({
      stack: [
        // Gradient Accent Line
        {
          canvas: [{ 
            type: 'rect', 
            x: 0, y: 0, w: 612, h: 4, 
            linearGradient: [BRAND.TEAL, BRAND.GREEN, BRAND.LIME] 
          }] 
        },
        // Dark Footer Block
        {
          table: {
            widths: ['*'],
            body: [[
              {
                text: '¡ATRÉVETE A CAMBIAR!',
                color: BRAND.WHITE,
                fontSize: 10,
                bold: true,
                alignment: 'center',
                fillColor: BRAND.BLACK,
                border: [false, false, false, false],
                margin: [0, 10, 0, 10]
              }
            ]]
          },
          layout: 'noBorders'
        }
      ],
      margin: [0, 0, 0, 0]
    }),
    
    defaultStyle: { 
      fontSize: 10.5 * globalScale, 
      lineHeight: 1.3,
      color: BRAND.BLACK // Default text is now "Black" (Charcoal)
    }
  };
  
  return pdfMake.createPdf(docDefinition, {});
}

/**
 * Export heuristic for external use / testing
 */
export { estimateOptimalScale };