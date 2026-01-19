import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';

export const ChatInput = ({ 
  input, 
  setInput, 
  isLoading, 
  handleSendMessage, 
  role 
}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-NG'; // Nigerian English

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [setInput]);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <footer className="p-3 sm:p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl safe-area-bottom">
      <div className="max-w-4xl mx-auto flex gap-2 sm:gap-3 items-end">
        <div className="flex-1 relative">
          <textarea 
            rows={1} 
            value={input} 
            onChange={(e) => { 
              setInput(e.target.value); 
              e.target.style.height = 'auto'; 
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'; 
            }} 
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} 
            placeholder={`Ask about ${role} taxes...`} 
            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl sm:rounded-2xl md:rounded-[1.5rem] px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 pr-11 sm:pr-12 md:pr-14 text-xs sm:text-sm font-bold focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 resize-none outline-none transition-all shadow-inner no-scrollbar dark:text-slate-100 dark:placeholder-slate-500" 
          />
          <button
            onClick={handleVoiceInput}
            className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
            title={isListening ? "Stop recording" : "Start voice input"}
          >
            {isListening ? <MicOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Mic size={16} className="sm:w-[18px] sm:h-[18px]" />}
          </button>
        </div>
        <button 
          onClick={handleSendMessage} 
          disabled={isLoading || !input.trim()} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl shadow-lg transition-all flex items-center justify-center active:scale-90 disabled:opacity-50 flex-shrink-0"
        >
          {isLoading ? (
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <Send size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
          )}
        </button>
      </div>
    </footer>
  );
};
