import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Printer, Download, Mail, Loader2, X, Check, AlertTriangle } from "lucide-react";
import { PDFViewer, pdf } from '@react-pdf/renderer';
import ServiceProgramPdf from './ServiceProgramPdf';
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

const MOBILE_BREAKPOINT = 768;

export default function ServicePdfPreview({
  open,
  onOpenChange,
  serviceData,
  selectedDate,
  fixedAnnouncements,
  dynamicAnnouncements,
  selectedAnnouncements,
  pdfScales,
  onSaveScales
}) {
  const [activeTab, setActiveTab] = useState("page1");
  const [page1Scale, setPage1Scale] = useState(pdfScales?.page1 || 100);
  const [page2Scale, setPage2Scale] = useState(pdfScales?.page2 || 100);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Monitor window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate PDF client-side whenever inputs change
  useEffect(() => {
    if (!open) return; // Don't generate if dialog is closed
    
    const generatePdf = async () => {
      setPdfLoading(true);
      try {
        const blob = await pdf(
          <ServiceProgramPdf
            serviceData={serviceData}
            selectedDate={selectedDate}
            fixedAnnouncements={fixedAnnouncements}
            dynamicAnnouncements={dynamicAnnouncements}
            selectedAnnouncements={selectedAnnouncements}
            page1Scale={page1Scale}
            page2Scale={page2Scale}
          />
        ).toBlob();
        
        // Revoke previous URL
        if (pdfBlobUrl) {
          URL.revokeObjectURL(pdfBlobUrl);
        }
        
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      } catch (error) {
        console.error('PDF generation error:', error);
      } finally {
        setPdfLoading(false);
      }
    };

    generatePdf();

    // Cleanup on unmount
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [open, serviceData, selectedDate, fixedAnnouncements, dynamicAnnouncements, selectedAnnouncements, page1Scale, page2Scale]);

  const handlePrint = () => {
    if (!pdfBlobUrl) {
      alert('PDF no está listo / PDF not ready.');
      return;
    }
    window.open(pdfBlobUrl, '_blank');
  };

  const handleDownloadPDF = () => {
    if (!pdfBlobUrl) {
      alert('PDF no está listo para descargar / PDF not ready for download.');
      return;
    }
    
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.download = `Orden-de-Servicio-${selectedDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      alert('Por favor ingrese un email válido / Please enter a valid email');
      return;
    }

    setSendingEmail(true);
    
    try {
      const liveViewUrl = window.location.origin + createPageUrl('PublicProgramView') + `?date=${selectedDate}`;
      
      await base44.integrations.Core.SendEmail({
        to: emailAddress,
        subject: `Orden de Servicio - Domingo ${selectedDate}`,
        body: `
          <h2>Orden de Servicio / Service Order</h2>
          <p>Fecha / Date: ${selectedDate}</p>
          <p>Puede ver el programa de servicio completo en línea aquí:</p>
          <p><a href="${liveViewUrl}" style="color: #1F8A70; font-weight: bold;">${liveViewUrl}</a></p>
          <hr style="margin: 20px 0;"/>
          <p style="color: #666; font-size: 12px;">Este documento fue generado desde el sistema de gestión de servicios de Palabras de Vida.</p>
          <p style="color: #666; font-size: 12px;">This document was generated from the Palabras de Vida service management system.</p>
        `
      });
      
      setEmailSent(true);
      setTimeout(() => {
        setEmailSent(false);
        setShowEmailForm(false);
        setEmailAddress("");
      }, 2000);
      
    } catch (error) {
      console.error('Email error:', error);
      alert('Error al enviar email / Error sending email: ' + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSaveAndClose = () => {
    onSaveScales({ page1: page1Scale, page2: page2Scale });
    onOpenChange(false);
  };

  const adjustScale = (pageNum, delta) => {
    if (pageNum === 1) {
      setPage1Scale(prev => Math.min(110, Math.max(85, prev + delta)));
    } else {
      setPage2Scale(prev => Math.min(110, Math.max(85, prev + delta)));
    }
  };

  // Desktop only - mobile never shows this dialog
  if (isMobile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] max-h-[95vh] w-[95vw] p-0 flex flex-col">
        
        <DialogHeader className="flex-shrink-0 px-6 py-3 border-b bg-white">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-xl font-bold">
              Vista Previa PDF / PDF Preview
            </DialogTitle>
            <div className="flex gap-2 flex-shrink-0">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0"
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button 
                onClick={handleSaveAndClose} 
                variant="outline"
                className="border-pdv-teal text-pdv-teal hover:bg-pdv-teal hover:text-white h-8 w-8 p-0"
                size="sm"
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Controls Panel */}
          <div className="w-72 border-r bg-gray-50 p-4 space-y-4 overflow-y-auto flex-shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Página 1 / Page 1</span>
                <Badge variant="outline">{page1Scale}%</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => adjustScale(1, -5)}
                  disabled={page1Scale <= 85}
                >
                  <Minus className="w-4 h-4" />
                </Button>

                <div className="flex-1">
                  <Slider
                    value={[page1Scale]}
                    onValueChange={([v]) => setPage1Scale(v)}
                    min={85}
                    max={110}
                    step={1}
                    className="w-full"
                  />
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => adjustScale(1, 5)}
                  disabled={page1Scale >= 110}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Página 2 / Page 2</span>
                <Badge variant="outline">{page2Scale}%</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => adjustScale(2, -5)}
                  disabled={page2Scale <= 85}
                >
                  <Minus className="w-4 h-4" />
                </Button>

                <div className="flex-1">
                  <Slider
                    value={[page2Scale]}
                    onValueChange={([v]) => setPage2Scale(v)}
                    min={85}
                    max={110}
                    step={1}
                    className="w-full"
                  />
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => adjustScale(2, 5)}
                  disabled={page2Scale >= 110}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <h3 className="text-sm font-bold text-gray-700 uppercase">Acciones / Actions</h3>
              
              <Button 
                onClick={handlePrint}
                disabled={pdfLoading}
                className="w-full bg-gray-900 text-white hover:bg-gray-800"
              >
                {pdfLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                Imprimir / Print
              </Button>

              <Button 
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                variant="outline"
                className="w-full"
              >
                {pdfLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Descargar / Download
              </Button>

              {!showEmailForm && (
                <Button
                  onClick={() => setShowEmailForm(true)}
                  disabled={pdfLoading}
                  variant="outline"
                  className="w-full"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar Email / Send Email
                </Button>
              )}

              {showEmailForm && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs">Email del destinatario</Label>
                  <Input
                    type="email"
                    placeholder="ejemplo@email.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    disabled={sendingEmail}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowEmailForm(false);
                        setEmailAddress("");
                      }}
                      disabled={sendingEmail}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSendEmail}
                      disabled={!emailAddress || sendingEmail || emailSent}
                      className="bg-pdv-teal text-white flex-1"
                    >
                      {sendingEmail ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : emailSent ? (
                        <Check className="w-3 h-3 mr-1" />
                      ) : (
                        <Mail className="w-3 h-3 mr-1" />
                      )}
                      {emailSent ? '✓ Enviado' : 'Enviar'}
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    Se enviará un enlace a la vista en vivo del programa
                  </p>
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                💡 Ajuste la escala si el contenido no cabe en la página. El encabezado y pie de página permanecen fijos.
              </p>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 bg-gray-200 overflow-hidden relative">
            {pdfLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-pdv-teal mx-auto mb-3" />
                  <p className="text-gray-600">Generando PDF...</p>
                </div>
              </div>
            ) : (
              <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
                <ServiceProgramPdf
                  serviceData={serviceData}
                  selectedDate={selectedDate}
                  fixedAnnouncements={fixedAnnouncements}
                  dynamicAnnouncements={dynamicAnnouncements}
                  selectedAnnouncements={selectedAnnouncements}
                  page1Scale={page1Scale}
                  page2Scale={page2Scale}
                />
              </PDFViewer>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}