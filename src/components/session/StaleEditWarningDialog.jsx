/**
 * StaleEditWarningDialog — Phase 5: Concurrent Editing Guard
 *
 * Shown when a user tries to save an entity that was modified by someone else
 * since they opened the form. Offers "Force Save" or "Cancel".
 *
 * DESIGN: Warning, not blocking. Users can always force-save.
 * Uses updated_date comparison (optimistic locking).
 */

import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

export default function StaleEditWarningDialog({ open, onCancel, onForceSave, staleInfo, language = "es" }) {
  const modifiedBy = staleInfo?.modifiedBy || (language === "es" ? "otro usuario" : "another user");
  const serverDate = staleInfo?.serverDate
    ? new Date(staleInfo.serverDate).toLocaleString(language === "es" ? "es-ES" : "en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/New_York",
      })
    : "";

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent className="bg-white max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {language === "es" ? "Cambio detectado" : "Change Detected"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-700 space-y-2">
            <p>
              {language === "es"
                ? `Este registro fue modificado por ${modifiedBy} mientras lo editabas${serverDate ? ` (a las ${serverDate})` : ""}.`
                : `This record was modified by ${modifiedBy} while you were editing${serverDate ? ` (at ${serverDate})` : ""}.`}
            </p>
            <p className="font-medium text-amber-800">
              {language === "es"
                ? "Si guardas, tus cambios sobrescribirán los de esa persona."
                : "If you save, your changes will overwrite theirs."}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {language === "es" ? "Cancelar" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onForceSave}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {language === "es" ? "Guardar de todas formas" : "Save Anyway"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}