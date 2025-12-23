import React, { useState, useEffect, useRef } from "react";
import { X, Plus, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

export default function MultiPersonSelect({ 
  value = [], 
  onChange, 
  placeholder = "Agregar persona...",
  className,
  disabled = false
}) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!inputValue.trim()) {
        setSuggestions([]);
        return;
      }

      try {
        // Fetch from SuggestionItem (Personas - Sugerencias)
        const response = await base44.functions.invoke('refreshSuggestions', {
          inputType: 'person',
          searchTerm: inputValue
        });
        
        if (response.data?.suggestions) {
          setSuggestions(response.data.suggestions);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(debounce);
  }, [inputValue]);

  const handleAddPerson = (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    
    const currentValues = Array.isArray(value) ? value : [];
    if (!currentValues.includes(trimmedName)) {
      onChange([...currentValues, trimmedName]);
    }
    
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleRemovePerson = (nameToRemove) => {
    const currentValues = Array.isArray(value) ? value : [];
    onChange(currentValues.filter(name => name !== nameToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleAddPerson(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        handleAddPerson(inputValue);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      handleRemovePerson(value[value.length - 1]);
    }
  };

  const currentValues = Array.isArray(value) ? value : [];

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className={cn(
        "flex flex-wrap gap-2 p-2 border rounded-md bg-white min-h-[42px]",
        disabled && "opacity-50 cursor-not-allowed bg-gray-50"
      )}>
        {currentValues.map((name, index) => (
          <Badge 
            key={index} 
            variant="outline" 
            className="gap-1 px-2 py-1 bg-gradient-to-r from-teal-50 to-green-50 border-teal-200 text-teal-800"
          >
            <User className="w-3 h-3" />
            {name}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemovePerson(name)}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}
        <div className="flex-1 min-w-[120px]">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
              setHighlightedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={currentValues.length === 0 ? placeholder : ""}
            disabled={disabled}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-6"
          />
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleAddPerson(suggestion)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-teal-50 flex items-center gap-2",
                index === highlightedIndex && "bg-teal-50"
              )}
            >
              <User className="w-4 h-4 text-teal-600" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}