import React from "react";
import { Info, Bookmark, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function FieldOriginIndicator({ origin, fieldName }) {
  if (!origin || origin === 'manual') return null;

  const isTemplate = origin === 'template';
  const isDuplicate = origin === 'duplicate';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center`}>
            {isTemplate && (
              <Bookmark className="w-3 h-3 text-blue-400/70" />
            )}
            {isDuplicate && (
              <Copy className="w-3 h-3 text-amber-400/70" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {isTemplate ? "Valor original de la plantilla" : "Valor duplicado original"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function getFieldOrigin(fieldOrigins, fieldName) {
  if (!fieldOrigins) return 'manual';
  return fieldOrigins[fieldName] || 'manual';
}

// Helper to populate field origins object for a new entity
export function createFieldOrigins(entity, originType) {
  const fieldOrigins = {};
  Object.keys(entity).forEach(key => {
    // Skip system fields and complex objects if necessary, though marking them is fine
    if (key !== 'id' && key !== 'created_date' && key !== 'updated_date' && key !== 'created_by') {
      fieldOrigins[key] = originType;
    }
  });
  return fieldOrigins;
}