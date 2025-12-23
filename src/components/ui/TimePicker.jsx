import React, { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function TimePicker({ 
  value, 
  onChange, 
  placeholder = "Seleccionar hora",
  disabled = false,
  className,
  required = false,
  min,
  ...props 
}) {
  const [hour, setHour] = useState("00");
  const [minute, setMinute] = useState("00");
  const [open, setOpen] = useState(false);

  // Parse value into hour/minute on mount or value change
  useEffect(() => {
    if (value && typeof value === 'string') {
      const parts = value.split(':');
      if (parts.length === 2) {
        setHour(parts[0].padStart(2, '0'));
        setMinute(parts[1].padStart(2, '0'));
      }
    }
  }, [value]);

  const handleApply = () => {
    const timeString = `${hour}:${minute}`;
    onChange(timeString);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setHour("00");
    setMinute("00");
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          {...props}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value ? (
            <span>{value}</span>
          ) : (
            <span>{placeholder}</span>
          )}
          {value && !disabled && (
            <X 
              className="ml-auto h-4 w-4 text-gray-400 hover:text-gray-600" 
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Hora</label>
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-pdv-green"
                style={{ maxHeight: '200px' }}
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="text-xl font-bold text-gray-400 mt-5">:</div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Min</label>
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-pdv-green"
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <div className="text-2xl font-bold text-gray-700">
              {hour}:{minute}
            </div>
            <Button
              size="sm"
              onClick={handleApply}
              className="bg-pdv-green hover:bg-pdv-teal text-white"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}