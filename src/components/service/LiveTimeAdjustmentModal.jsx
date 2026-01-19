import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/utils/i18n";
import { Clock, AlertTriangle } from "lucide-react";

export default function LiveTimeAdjustmentModal({ 
  isOpen, 
  onClose, 
  timeSlot, 
  currentOffset, 
  onSave 
}) {
  const { t } = useLanguage();
  const [offsetMinutes, setOffsetMinutes] = useState(currentOffset || 0);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!authorizedBy.trim()) {
      alert(t('live.authorization_required') || 'Please specify who authorized this change');
      return;
    }

    setIsLoading(true);
    try {
      await onSave(offsetMinutes, authorizedBy);
      onClose();
    } catch (err) {
      console.error(err);
      alert(t('error.generic') || 'Error saving adjustment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!authorizedBy.trim()) {
      alert(t('live.authorization_required') || 'Please specify who authorized clearing this adjustment');
      return;
    }

    setIsLoading(true);
    try {
      await onSave(0, authorizedBy);
      onClose();
    } catch (err) {
      console.error(err);
      alert(t('error.generic') || 'Error clearing adjustment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            {t('live.adjust_service_time') || `Adjust ${timeSlot} Service Time`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-900">
                {t('live.adjustment_warning') || 'This will shift all segment times in the live view only. PDFs and saved data are not affected.'}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="offset" className="font-bold">
              {t('live.time_offset') || 'Time Offset (minutes)'}
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setOffsetMinutes(Math.max(-60, offsetMinutes - 5))}
                disabled={isLoading}
              >
                -5
              </Button>
              <Input
                id="offset"
                type="number"
                value={offsetMinutes}
                onChange={(e) => setOffsetMinutes(parseInt(e.target.value) || 0)}
                className="text-center font-bold text-lg"
                disabled={isLoading}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setOffsetMinutes(Math.min(60, offsetMinutes + 5))}
                disabled={isLoading}
              >
                +5
              </Button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {t('live.offset_help') || 'Positive = later, Negative = earlier (max ±60 min)'}
            </p>
          </div>

          <div>
            <Label htmlFor="authorized" className="font-bold text-red-600">
              {t('live.who_authorized') || 'Who authorized this change?'} *
            </Label>
            <Input
              id="authorized"
              type="text"
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
              placeholder={t('live.authorized_placeholder') || 'e.g., Pastor Juan, Coordinator Maria'}
              className="mt-2"
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentOffset !== 0 && (
            <Button 
              variant="outline" 
              onClick={handleClear}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {t('live.clear_adjustment') || 'Clear Adjustment'}
            </Button>
          )}
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            {t('live.apply_adjustment') || 'Apply Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}