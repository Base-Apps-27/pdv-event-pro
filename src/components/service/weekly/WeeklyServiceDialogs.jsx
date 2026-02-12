/**
 * WeeklyServiceDialogs.jsx
 * Phase 3A extraction: All remaining inline dialogs from WeeklyServiceManager.
 * Includes: Delete Confirmation, Reset Blueprint Confirmation,
 * Verse Parser, Print Settings, and Announcement Edit dialogs.
 * Verbatim extraction — zero logic changes.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import PrintSettingsModal from "@/components/print/PrintSettingsModal";
import VerseParserDialog from "@/components/service/VerseParserDialog";
import StaticAnnouncementForm from "@/components/announcements/StaticAnnouncementForm";

export default function WeeklyServiceDialogs({
  // Delete confirmation
  deleteConfirmId,
  setDeleteConfirmId,
  deleteAnnouncementMutation,
  // Reset blueprint confirmation
  showResetConfirm,
  setShowResetConfirm,
  executeResetToBlueprint,
  // Verse parser
  verseParserOpen,
  setVerseParserOpen,
  verseParserContext,
  handleSaveParsedVerses,
  // Print settings
  showPrintSettings,
  setShowPrintSettings,
  activePrintSettingsPage1,
  activePrintSettingsPage2,
  handleSavePrintSettings,
  serviceData,
  // Announcement dialog
  showAnnouncementDialog,
  setShowAnnouncementDialog,
  editingAnnouncement,
  announcementForm,
  setAnnouncementForm,
  handleAnnouncementSubmit,
  optimizeAnnouncementWithAI,
  optimizingAnnouncement,
}) {
  return (
    <>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">¿Estás seguro de que deseas eliminar este anuncio?</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button 
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                deleteAnnouncementMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Settings Modal */}
      <PrintSettingsModal
        open={showPrintSettings}
        onOpenChange={setShowPrintSettings}
        settingsPage1={activePrintSettingsPage1}
        settingsPage2={activePrintSettingsPage2}
        onSave={handleSavePrintSettings}
        language="es"
        serviceData={serviceData}
      />

      {/* Reset Blueprint Confirmation Dialog — Phase 1 (2026-02-11) */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>Confirmar Restablecimiento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">¿Estás seguro? Esto restablecerá TODOS los segmentos y campos al diseño original. Se perderán los datos ingresados en los segmentos.</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={executeResetToBlueprint}
            >
              Restablecer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verse Parser Dialog */}
      <VerseParserDialog
        open={verseParserOpen}
        onOpenChange={setVerseParserOpen}
        initialText={verseParserContext.initialText || ""}
        onSave={handleSaveParsedVerses}
        language="es"
      />

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {editingAnnouncement ? "Editar Anuncio / Edit Announcement" : "Nuevo Anuncio / New Announcement"}
              </DialogTitle>
              {editingAnnouncement && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteConfirmId(editingAnnouncement.id);
                    setShowAnnouncementDialog(false);
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar / Delete
                </Button>
              )}
            </div>
          </DialogHeader>
          <StaticAnnouncementForm
            announcement={announcementForm}
            onChange={setAnnouncementForm}
            onSave={handleAnnouncementSubmit}
            onCancel={() => setShowAnnouncementDialog(false)}
            isEditing={!!editingAnnouncement}
            onOptimize={optimizeAnnouncementWithAI}
            optimizing={optimizingAnnouncement}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}