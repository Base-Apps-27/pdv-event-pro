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
  invalid = false,
  className,
  ...props 
}) {
  const [hour, setHour] = useState("9");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState("AM");

  // Parse value (HH:MM in 24-hour format) into 12-hour components
  useEffect(() => {
    if (value && typeof value === 'string') {
      const [h, m] = value.split(':');
      const hourNum = parseInt(h, 10);
      const minuteNum = parseInt(m, 10);
      
      if (!isNaN(hourNum) && !isNaN(minuteNum)) {
        if (hourNum === 0) {
          setHour("12");
          setPeriod("AM");
        } else if (hourNum < 12) {
          setHour(String(hourNum));
          setPeriod("AM");
        } else if (hourNum === 12) {
          setHour("12");
          setPeriod("PM");
        } else {
          setHour(String(hourNum - 12));
          setPeriod("PM");
        }
        setMinute(m);
      }
    }
  }, [value]);

  const handleApply = () => {
    // Convert 12-hour to 24-hour format
    let hour24 = parseInt(hour, 10);
    if (period === "AM" && hour24 === 12) {
      hour24 = 0;
    } else if (period === "PM" && hour24 !== 12) {
      hour24 += 12;
    }
    const formatted = `${String(hour24).padStart(2, '0')}:${minute}`;
    onChange(formatted);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setHour("9");
    setMinute("00");
    setPeriod("AM");
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const formatDisplay = (val) => {
    if (!val) return placeholder;
    const [h, m] = val.split(':');
    const hourNum = parseInt(h, 10);
    let displayHour = hourNum;
    let displayPeriod = "AM";
    
    if (hourNum === 0) {
      displayHour = 12;
      displayPeriod = "AM";
    } else if (hourNum < 12) {
      displayHour = hourNum;
      displayPeriod = "AM";
    } else if (hourNum === 12) {
      displayHour = 12;
      displayPeriod = "PM";
    } else {
      displayHour = hourNum - 12;
      displayPeriod = "PM";
    }
    
    return `${displayHour}:${m} ${displayPeriod}`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          style={{
            backgroundColor: '#ffffff',
            color: value ? '#111827' : '#9ca3af',
            borderColor: '#d1d5db'
          }}
          {...props}
        >
          <Clock className="mr-2 h-4 w-4" style={{ color: '#6b7280' }} />
          <span style={{ color: value ? '#111827' : '#9ca3af' }}>
            {formatDisplay(value)}
          </span>
          {value && !disabled && (
            <X 
              className="ml-auto h-4 w-4" 
              style={{ color: '#9ca3af' }}
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-3" 
        align="start"
        style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
      >
        <div className="space-y-3">
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <label 
                className="text-xs font-semibold mb-1 block"
                style={{ color: '#374151' }}
              >
                Hora
              </label>
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  maxHeight: '200px'
                }}
              >
                {hours.map((h) => (
                  <option 
                    key={h} 
                    value={h}
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                  >
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xl font-bold mt-5" style={{ color: '#9ca3af' }}>:</div>
            <div className="flex-1">
              <label 
                className="text-xs font-semibold mb-1 block"
                style={{ color: '#374151' }}
              >
                Min
              </label>
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #d1d5db'
                }}
              >
                {minutes.map((m) => (
                  <option 
                    key={m} 
                    value={m}
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                  >
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label 
                className="text-xs font-semibold mb-1 block"
                style={{ color: '#374151' }}
              >
                AM/PM
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #d1d5db'
                }}
              >
                <option value="AM" style={{ backgroundColor: '#ffffff', color: '#111827' }}>AM</option>
                <option value="PM" style={{ backgroundColor: '#ffffff', color: '#111827' }}>PM</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleApply}
              className="flex-1 text-sm font-semibold"
              style={{
                background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
                color: '#ffffff',
                border: 'none'
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}