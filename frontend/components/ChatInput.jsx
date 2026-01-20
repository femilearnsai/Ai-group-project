import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';

export const ChatInput = ({ 
  input, 
  setInput, 
  isLoading, 
  handleSendMessage, 
  role 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-NG'; // Nigerian English

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        if (finalTranscript) {
          setInput((prev) => prev + (prev ? ' ' : '') + finalTranscript);
          setTranscript('');
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setTranscript('');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setTranscript('');
      };
    }
  }, [setInput]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setTranscript('');
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <footer className="p-3 sm:p-4 md:p-5 lg:p-6 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl safe-area-bottom">
      <div className="max-w-4xl mx-auto">
        {/* Voice Recording Indicator */}
        {isListening && (
          <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Listening...
              </span>
            </div>
            {transcript && (
              <span className="text-sm text-emerald-600 dark:text-emerald-300 font-medium italic truncate flex-1">
                "{transcript}"
              </span>
            )}
            <button
              onClick={handleVoiceInput}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-2 py-1 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
            >
              Stop
            </button>
          </div>
        )}
        
        <div className="flex gap-2 sm:gap-3 items-end">
          {/* Voice Input Button */}
          <button
            onClick={handleVoiceInput}
            className={`flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              isListening 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700'
            }`}
            title={isListening ? "Stop recording" : "Start voice input"}
            aria-label={isListening ? "Stop recording" : "Start voice input"}
          >
            {isListening ? (
              <MicOff size={18} className="sm:w-5 sm:h-5" />
            ) : (
              <Mic size={18} className="sm:w-5 sm:h-5" />
            )}
          </button>
          
          {/* Text Input */}
          <div className="flex-1 relative min-w-0">
            <textarea 
              ref={textareaRef}
              rows={1} 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={handleKeyDown}
              placeholder="Ask about Nigeria's tax reform..." 
              className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-medium focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-emerald-500/10 resize-none outline-none transition-all dark:text-slate-100 dark:placeholder-slate-500 no-scrollbar" 
              disabled={isLoading}
            />
          </div>
          
          {/* Send Button */}
          <button 
            onClick={handleSendMessage} 
            disabled={isLoading || !input.trim()} 
            className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center active:scale-95 disabled:cursor-not-allowed disabled:shadow-none"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 size={18} className="sm:w-5 sm:h-5 animate-spin" />
            ) : (
              <Send size={18} className="sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
        
        {/* Helper Text */}
        <p className="mt-2 text-center text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium">
          Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold">Shift+Enter</kbd> for new line
        </p>
      </div>
    </footer>
  );
};
