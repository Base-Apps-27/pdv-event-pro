import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import { base44 } from '@/api/base44Client';

export function usePdfGenerator() {
  
  const captureElement = async (element) => {
    if (!element) return null;
    
    const canvas = await html2canvas(element, {
      scale: 2, // 2x for better quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    
    return canvas.toDataURL('image/png');
  };

  const generatePdf = useCallback(async ({ 
    page1Ref, 
    page2Ref, 
    selectedDate,
    onProgress 
  }) => {
    try {
      onProgress?.('Renderizando página 1...');
      
      // Capture page 1
      const page1Image = await captureElement(page1Ref.current);
      if (!page1Image) {
        throw new Error('Failed to capture page 1');
      }

      // Capture page 2 if ref exists
      let page2Image = null;
      if (page2Ref?.current) {
        onProgress?.('Renderizando página 2...');
        page2Image = await captureElement(page2Ref.current);
      }

      onProgress?.('Generando PDF...');

      // Send to server to assemble PDF
      const response = await base44.functions.invoke('generateServicePdf', {
        page1Image,
        page2Image,
        selectedDate
      });

      return response.data;

    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  }, []);

  const downloadPdf = useCallback(async (pdfData, filename) => {
    const blob = new Blob([pdfData], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }, []);

  return { generatePdf, downloadPdf, captureElement };
}