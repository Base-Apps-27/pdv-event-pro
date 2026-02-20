/**
 * WeeklyServiceDialogs.jsx
 * Phase 3A extraction: All remaining inline dialogs from WeeklyServiceManager.
 * Includes: Delete Confirmation, Reset Blueprint Confirmation (per-slot),
 * Verse Parser, Print Settings, and Announcement Edit dialogs.
 *
 * RESET-SLOT-FIX (2026-02-20): Reset dialog now allows per-slot reset or all-slots.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Trash2, AlertTriangle } from "lucide-react";
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
  // Slot names for per-slot reset
  slotNames = [],
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
  // RESET-SLOT-FIX (2026-02-20): Per-slot selection state for reset dialog
  const [resetSlots, setResetSlots] = useState({});

  // Initialize resetSlots when dialog opens (all checked by default)
  const handleResetDialogOpen = (open) => {
    if (open && slotNames.length > 0) {
      const initial = {};
      slotNames.forEach(name => { initial[name] = true; });
      setResetSlots(initial);
    }
    setShowResetConfirm(open);
  };

  const selectedSlotCount = Object.values(resetSlots).filter(Boolean).length;

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

      {/* Reset Blueprint Confirmation Dialog — RESET-SLOT-FIX (2026-02-20): Per-slot reset */}
      <Dialog open={showResetConfirm} onOpenChange={handleResetDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Confirmar Restablecimiento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Esto restablecerá los segmentos y campos al diseño del Blueprint. Se perderán los datos ingresados en los horarios seleccionados.
          </p>

          {/* Per-slot checkboxes — only show when more than 1 slot exists */}
          {slotNames.length > 1 && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 mt-2">
              <Label className="text-xs text-gray-500 uppercase font-semibold">Selecciona qué horarios restablecer:</Label>
              {slotNames.map(name => (
                <div key={name} className="flex items-center gap-3 py-1">
                  <Checkbox
                    id={`reset-${name}`}
                    checked={!!resetSlots[name]}
                    onCheckedChange={(checked) => setResetSlots(prev => ({ ...prev, [name]: !!checked }))}
                  />
                  <Label htmlFor={`reset-${name}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                    {name.replace('am', ' a.m.').replace('pm', ' p.m.')}
                  </Label>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={selectedSlotCount === 0}
              onClick={() => {
                // Pass which slots to reset
                const slotsToReset = slotNames.length > 1
                  ? slotNames.filter(name => resetSlots[name])
                  : slotNames; // single slot = always reset
                executeResetToBlueprint(slotsToReset);
              }}
            >
              Restablecer {slotNames.length > 1 && selectedSlotCount < slotNames.length
                ? `(${selectedSlotCount})`
                : 'Todo'}
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