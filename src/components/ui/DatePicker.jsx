// DatePicker — branded date selector (2026-03-02: confirmed rest-element fix)
import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function DatePicker({ 
  value, 
  onChange, 
  placeholder = "Seleccionar fecha",
  disabled = false,
  className,
  required = false,
  ...props
}) {
  const brandStyle = {
    background: 'linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%)',
  };

  const dateObj = value ? new Date(value + 'T12:00:00') : undefined;

  const handleSelect = (date) => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <Popover>
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
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            <span>{format(dateObj, "PPP", { locale: es })}</span>
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
        <style>{`
          [data-disabled="true"] {
            color: #d1d5db !important;
            cursor: not-allowed !important;
          }
          [data-disabled="true"]:hover {
            background-color: transparent !important;
          }
          button[role="gridcell"]:not([data-disabled="true"]):not([data-selected="true"]) {
            color: #111827 !important;
          }
          button[role="gridcell"][data-selected="true"],
          button[role="gridcell"][aria-selected="true"] {
            background-color: #8DC63F !important;
            color: white !important;
          }
          .rdp-day_selected {
            background-color: #8DC63F !important;
            color: white !important;
          }
        `}</style>
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={handleSelect}
          initialFocus
          {...props}
        />
      </PopoverContent>
    </Popover>
  );
}