import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, Clock, User, Calendar, ArrowRight } from "lucide-react";
import { formatTimestampToEST } from "@/components/utils/timeFormat";

export default function TimeAdjustmentHistoryModal({ 
  isOpen, 
  onClose, 
  logs = [],
  selectedDate 
}) {
  // Sort by most recent first (immutable logs)
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.created_date) - new Date(a.created_date)
  );

  const getActionLabel = (action) => {
    switch (action) {
      case 'set': return 'Establecido';
      case 'update': return 'Actualizado';
      case 'clear': return 'Limpiado';
      default: return action;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'set': return 'bg-green-100 text-green-800 border-green-300';
      case 'update': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'clear': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

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
          {sortedLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay ajustes registrados para esta fecha</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="border rounded-lg p-3 bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {/* Time Slot + Action Badge */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={
                            /^\d+:\d+[ap]m$/i.test(log.time_slot)
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-gray-50 border-gray-300 text-gray-700'
                          }
                        >
                          {log.time_slot === 'custom' ? 'Servicio' : log.time_slot}
                        </Badge>
                        
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </div>

                      {/* Offset Change Display */}
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <span className="text-gray-500">
                          {log.previous_offset > 0 ? '+' : ''}{log.previous_offset || 0} min
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className={`font-bold ${
                          log.new_offset > 0 
                            ? 'text-amber-700' 
                            : log.new_offset < 0 
                            ? 'text-green-700'
                            : 'text-gray-600'
                        }`}>
                          {log.new_offset > 0 ? '+' : ''}{log.new_offset} min
                        </span>
                      </div>

                      {/* Authorized By */}
                      <div className="flex items-center gap-1 text-sm text-gray-700 mb-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">{log.authorized_by || 'Sin registro'}</span>
                      </div>

                      {/* Performed By + Timestamp */}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>{formatTimestampToEST(log.created_date)}</span>
                        {(log.performed_by_name || log.performed_by_email) && (
                          <span className="ml-1">
                            — {log.performed_by_name || ''} {log.performed_by_email ? `(${log.performed_by_email})` : ''}
                          </span>
                        )}
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