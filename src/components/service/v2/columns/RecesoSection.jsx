/**
 * RecesoSection.jsx — V2 break notes between service slots.
 * Reads/writes from Service.receso_notes[slotName].
 * Uses markOwnWrite to suppress external change false positives.
 */

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function RecesoSection({ serviceId, slotName, recesoNotes, markOwnWrite }) {
  const value = recesoNotes?.[slotName] || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  // Debounced write directly to Service entity
  const timerRef = React.useRef(null);
  const handleChange = (val) => {
    setLocal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      markOwnWrite?.();
      const updated = { ...recesoNotes, [slotName]: val };
      base44.entities.Service.update(serviceId, { receso_notes: updated });
    }, 500);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <Card className="bg-gray-100 border-2 border-gray-400">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          RECESO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        <Textarea
          placeholder="Notas del receso (opcional)..."
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
          rows={2}
        />
      </CardContent>
    </Card>
  );
}