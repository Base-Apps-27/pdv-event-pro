import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

export default function OverlapDetectedDialog({ open, onCancel, onProceed, message }) {
  const { t, language } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onCancel?.(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            {language === 'es' ? 'Conflicto de horario' : 'Schedule Conflict'}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-700">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex items-center justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">{t('btn.cancel') || (language === 'es' ? 'Editar manualmente' : 'Edit manually')}</Button>
          </DialogClose>
          <Button onClick={onProceed} className="bg-blue-600 hover:bg-blue-700">
            {language === 'es' ? 'Ajustar segmentos posteriores…' : 'Adjust downstream…'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}