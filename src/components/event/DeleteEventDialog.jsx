import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

export default function DeleteEventDialog({ open, onOpenChange, onConfirm, eventName }) {
  const [confirmationText, setConfirmationText] = useState("");

  const handleConfirm = () => {
    if (confirmationText === "ELIMINAR") {
      onConfirm();
      setConfirmationText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) setConfirmationText("");
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-red-600 font-['Bebas_Neue'] tracking-wide uppercase">
            <AlertTriangle className="w-6 h-6" />
            Eliminar Evento
          </DialogTitle>
          <DialogDescription className="pt-2 font-medium">
            Esta acción no se puede deshacer. Esto eliminará permanentemente el evento <span className="font-bold text-gray-900">{eventName}</span> y todas sus sesiones, segmentos y datos asociados.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Para confirmar, por favor escribe la palabra <span className="font-bold select-all">ELIMINAR</span> a continuación:
          </p>
          <Input 
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="ELIMINAR"
            className="border-red-300 focus-visible:ring-red-500"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={confirmationText !== "ELIMINAR"}
            className="bg-red-600 hover:bg-red-700 font-bold uppercase"
          >
            Eliminar Evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}