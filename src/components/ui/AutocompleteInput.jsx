import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { getSuggestions, normalizeName, normalizeTitle, saveSuggestion } from '@/components/utils/textNormalization';

export default function AutocompleteInput({ 
  type, 
  value, 
  onChange, 
  onBlur,
  placeholder, 
  className,
  ...props 
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchTerm) => {
    const results = await getSuggestions(base44, type, searchTerm);
    setSuggestions(results);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(e);
    
    if (newValue.length > 0) {
      fetchSuggestions(newValue);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleBlur = async (e) => {
    // Normalize the value
    const rawValue = e.target.value;
    let normalized;
    
    if (type === 'songTitle' || type === 'messageTitle') {
      normalized = normalizeTitle(rawValue);
    } else {
      normalized = normalizeName(rawValue);
    }

    // Update the field with normalized value
    if (normalized !== rawValue) {
      const syntheticEvent = { target: { value: normalized } };
      onChange(syntheticEvent);
    }

    // Save to suggestions
    if (normalized) {
      await saveSuggestion(base44, type, rawValue);
    }

    // Call original onBlur if provided
    if (onBlur) {
      onBlur(e);
    }

    // Small delay to allow click on suggestion
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const selectSuggestion = (suggestion) => {
    const syntheticEvent = { target: { value: suggestion } };
    onChange(syntheticEvent);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (value) {
            fetchSuggestions(value);
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        {...props}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div 
          className="absolute z-50 w-full mt-1 border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto" 
          style={{ 
            backgroundColor: '#ffffff',
            color: '#111827'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-3 py-2 cursor-pointer text-sm"
              style={{
                color: index === selectedIndex ? '#ffffff !important' : '#111827 !important',
                backgroundColor: index === selectedIndex ? '#1F8A70' : '#ffffff'
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(suggestion);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}