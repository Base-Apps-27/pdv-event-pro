import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Loader2, FileText } from "lucide-react";

export default function TemplateSelectorDialog({ open, onOpenChange, onSelect }) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['eventTemplates'],
    queryFn: () => base44.entities.Event.filter({ status: 'template' }),
    enabled: open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 font-['Bebas_Neue'] tracking-wide uppercase">
            Seleccionar Plantilla
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed rounded-lg">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay plantillas de eventos disponibles.</p>
            <p className="text-sm text-gray-400 mt-1">Guarda un evento existente como plantilla para verlo aquí.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 py-4">
            {templates.map(template => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:shadow-md hover:border-blue-500 transition-all group" 
                onClick={() => onSelect(template)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </CardTitle>
                    <Calendar className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  {template.theme && (
                    <p className="text-sm text-gray-600 italic mb-2">"{template.theme}"</p>
                  )}
                  <p className="text-xs text-gray-400 line-clamp-2">
                    {template.description || "Sin descripción"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}