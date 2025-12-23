import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function MultiPersonSelect({ 
  value = [], 
  onChange, 
  placeholder = "Agregar personas...",
  type = "general",
  className = ""
}) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch persons for autocomplete
  const { data: persons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: () => base44.entities.Person.list(),
  });

  // Fetch suggestions for autocomplete
  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', type],
    queryFn: () => base44.entities.SuggestionItem.filter({ category: type }),
  });

  // Combine persons and suggestions for autocomplete
  const allOptions = [
    ...persons.map(p => `${p.first_name} ${p.last_name}`.trim()),
    ...suggestions.map(s => s.text)
  ].filter((v, i, a) => a.indexOf(v) === i); // unique values

  // Filter suggestions based on input
  const filteredSuggestions = inputValue.trim() 
    ? allOptions.filter(name => 
        name.toLowerCase().includes(inputValue.toLowerCase()) &&
        !value.includes(name)
      )
    : [];

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addName = (name) => {
    const trimmed = name.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue("");
      setHighlightedIndex(0);
      inputRef.current?.focus();
    }
  };

  const removeName = (nameToRemove) => {
    onChange(value.filter(name => name !== nameToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (filteredSuggestions.length > 0 && highlightedIndex < filteredSuggestions.length) {
        addName(filteredSuggestions[highlightedIndex]);
      } else {
        addName(inputValue);
      }
      setShowSuggestions(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => 
        Math.min(prev + 1, filteredSuggestions.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeName(value[value.length - 1]);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md bg-white min-h-[42px] focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-pdv-teal">
        {value.map((name, idx) => (
          <Badge 
            key={idx} 
            variant="secondary"
            className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-pdv-teal to-pdv-green text-white"
          >
            <span>{name}</span>
            <button
              type="button"
              onClick={() => removeName(name)}
              className="hover:bg-white/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredSuggestions.map((suggestion, idx) => (
            <div
              key={idx}
              onClick={() => {
                addName(suggestion);
                setShowSuggestions(false);
              }}
              className={`px-3 py-2 cursor-pointer text-sm ${
                idx === highlightedIndex 
                  ? 'bg-pdv-teal text-white' 
                  : 'hover:bg-gray-100'
              }`}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}