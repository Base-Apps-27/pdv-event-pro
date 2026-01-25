import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Keyboard } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";

/**
 * Voice-to-text button using Web Speech API
 * Inserts transcribed text into a textarea
 */
export default function VoiceInputButton({ textareaRef, onTranscriptionComplete, onAppendText }) {
  const { language, t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const transcriptRef = useRef("");
  const recognitionRef = useRef(null);
  const [hasSupport, setHasSupport] = useState(false);
  const [error, setError] = useState(null);
  const [interimText, setInterimText] = useState("");

  React.useEffect(() => {
    // Check if Web Speech API is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setHasSupport(!!SpeechRecognition);
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.language = language === 'es' ? 'es-ES' : 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        // Reset the rolling transcript at start to avoid stale closure issues
        transcriptRef.current = "";
        setInterimText("");
      };

      recognitionRef.current.onresult = (event) => {
        // Accumulate only final segments into a ref; show interim text for feedback
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const segment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            transcriptRef.current = `${(transcriptRef.current || "").trim()} ${segment}`.trim();
          } else {
            interim += segment;
          }
        }
        setInterimText(interim);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        const finalText = (transcriptRef.current || "").trim();
        if (finalText) {
          if (typeof onAppendText === 'function') {
            onAppendText(finalText);
          } else if (textareaRef?.current) {
            // Fallback: append to DOM textarea and notify React state
            const el = textareaRef.current;
            const currentValue = el.value || "";
            el.value = currentValue + (currentValue ? " " : "") + finalText;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          transcriptRef.current = "";
          setInterimText("");
          if (onTranscriptionComplete) {
            onTranscriptionComplete();
          }
        } else {
          setInterimText("");
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        transcriptRef.current = "";
        setInterimText("");
        setError(event.error || 'unknown');
      };
    }
  }, [language, textareaRef, onTranscriptionComplete]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      return; // Web Speech API not supported
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  if (!recognitionRef.current) {
    // Fallback: prompt users to use native keyboard dictation; focus textarea to open OS keyboard on mobile
    const focusInput = () => textareaRef?.current?.focus();
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={focusInput}
          className="border-pdv-teal text-pdv-teal"
          title={t('voice.start_dictation')}
        >
          <Keyboard className="w-4 h-4 mr-1" /> {t('voice.dictate')}
        </Button>
        <span className="text-xs text-gray-600">{t('voice.use_keyboard_mic')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={isListening ? "default" : "outline"}
        onClick={toggleListening}
        className={isListening ? "bg-red-600 hover:bg-red-700 text-white" : ""}
        title={t('voice.mic_title')}
      >
        {isListening ? (
          <>
            <Square className="w-4 h-4 mr-1 animate-pulse" />
            {t('voice.listening')}
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 mr-1" />
            {t('voice.voice')}
          </>
        )}
      </Button>
      {isListening && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 animate-pulse">{t('voice.listening')}</span>
          {interimText && (
            <span className="text-xs text-gray-500 italic truncate max-w-[12rem]">{interimText}</span>
          )}
        </div>
      )}
    </div>
  );
}