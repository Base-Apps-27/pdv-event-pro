import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, Clock, User, Calendar } from "lucide-react";
import { formatTimeToEST, formatTimestampToEST } from "@/components/utils/timeFormat";

export default function TimeAdjustmentHistoryModal({ 
  isOpen, 
  onClose, 
  adjustments = [],
  selectedDate 
}) {
  // Sort by most recent first
  const sortedAdjustments = [...adjustments].sort(
    (a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Historial de Ajustes de Horario
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            {selectedDate}
          </p>
        </DialogHeader>

        <div className="py-4">
          {sortedAdjustments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay ajustes registrados para esta fecha</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedAdjustments.map((adj) => (
                <div 
                  key={adj.id} 
                  className="border rounded-lg p-3 bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {/* Time Slot Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          variant="outline" 
                          className={
                            adj.time_slot === '9:30am' 
                              ? 'bg-red-50 border-red-300 text-red-700' 
                              : adj.time_slot === '11:30am'
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-gray-50 border-gray-300 text-gray-700'
                          }
                        >
                          {adj.time_slot || adj.adjustment_type || 'Global'}
                        </Badge>
                        
                        {/* Offset Display */}
                        <Badge 
                          className={
                            adj.offset_minutes > 0 
                              ? 'bg-amber-100 text-amber-800' 
                              : adj.offset_minutes < 0 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }
                        >
                          {adj.offset_minutes > 0 ? '+' : ''}{adj.offset_minutes} min
                        </Badge>
                      </div>

                      {/* Authorized By */}
                      <div className="flex items-center gap-1 text-sm text-gray-700 mb-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">{adj.authorized_by || 'Sin registro'}</span>
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {adj.updated_date 
                            ? formatTimestampToEST(adj.updated_date)
                            : formatTimestampToEST(adj.created_date)
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}