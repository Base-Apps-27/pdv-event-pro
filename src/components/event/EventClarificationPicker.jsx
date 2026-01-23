import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, AlertCircle } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

/**
 * Modal for user to pick from AI's 3-option event clarification
 * Shows event name, year, session count
 */
export default function EventClarificationPicker({
  isOpen,
  options,
  onSelect,
  onCancel,
  isLoading
}) {
  const { language, t } = useLanguage();

  if (!options || options.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            {language === 'es' ? 'Cuál evento?' : 'Which event?'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {language === 'es' 
              ? 'Selecciona el evento que quisiste mencionar:'
              : 'Select the event you meant:'}
          </p>

          {options.map((option, idx) => (
            <Card
              key={option.id}
              className="p-4 cursor-pointer hover:bg-blue-50 transition-colors border-gray-200"
              onClick={() => onSelect(option)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 break-words">
                    {option.name}
                  </h4>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {option.year}
                    </span>
                    {option.session_count !== undefined && (
                      <span>
                        {option.session_count} {language === 'es' ? 'sesiones' : 'sessions'}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(option);
                  }}
                  disabled={isLoading}
                  className="flex-shrink-0"
                >
                  {isLoading ? '...' : language === 'es' ? 'Usar' : 'Use'}
                </Button>
              </div>
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full"
          >
            {language === 'es' ? 'Cancelar' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}