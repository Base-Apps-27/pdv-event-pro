/**
 * PreServiceSection.jsx — V2 pre-service notes input.
 * Reads from PreSessionDetails entity directly.
 */

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

export default function PreServiceSection({ session, psd, onWritePSD }) {
  const value = psd?.general_notes || '';
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <Card className="bg-gray-100 border-2 border-gray-400">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
          <Clock className="w-4 h-4" />
          PRE-SERVICIO
          <Badge variant="outline" className="ml-auto text-xs text-gray-600 border-gray-500">Antes de iniciar</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        <Textarea
          placeholder="Instrucciones pre-servicio (opcional)..."
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            onWritePSD(psd?.id || null, session.id, 'general_notes', e.target.value);
          }}
          className="text-xs bg-white border-gray-300 text-gray-700 placeholder:text-gray-400"
          rows={2}
        />
      </CardContent>
    </Card>
  );
}