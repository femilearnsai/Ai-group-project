import React from 'react';
import { Info, MessageSquare, Scale, FileText, Calculator } from 'lucide-react';
import { MessageBubble } from './MessageBubble.jsx';

// Hero section for new chats
const HeroSection = ({ greeting }) => (
  <div className="flex flex-col items-center justify-center py-8 sm:py-12 md:py-16 lg:py-20 px-4">
    {/* Logo/Icon */}
    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6 sm:mb-8">
      <Scale className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
    </div>
    
    {/* Title */}
    <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 text-center mb-2 sm:mb-3 tracking-tight">
      Nigeria Tax Reform Assistant
    </h1>
    
    {/* Subtitle */}
    <p className="text-xs sm:text-sm md:text-base text-slate-500 dark:text-slate-400 text-center max-w-md mb-6 sm:mb-8 font-medium">
      Your AI-powered guide to Nigeria's 2025 Tax Reform Bills
    </p>
    
    {/* Greeting Message */}
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 md:p-6 max-w-lg w-full shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
          <MessageSquare size={16} className="sm:w-[18px] sm:h-[18px] text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
            AI Assistant
          </p>
          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
            {greeting}
          </p>
        </div>
      </div>
    </div>
    
    {/* Quick Action Hints */}
    <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 w-full max-w-lg">
      <QuickHint icon={FileText} text="Ask about tax rates" />
      <QuickHint icon={Calculator} text="Calculate your tax" />
      <QuickHint icon={Scale} text="Legal provisions" />
    </div>
  </div>
);

const QuickHint = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
    <Icon size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{text}</span>
  </div>
);

export const ChatSection = ({ currentChat, error, onRegenerate, sessionId, onEdit, onVersionChange }) => {
  // Find the index of the last assistant message
  const lastAssistantIndex = currentChat 
    ? currentChat.map((m, i) => (m.role === 'assistant' || m.role === 'ai') ? i : -1).filter(i => i >= 0).pop()
    : -1;

  // Check if this is a new chat with only the greeting
  const isNewChat = currentChat && currentChat.length === 1 && currentChat[0].isGreeting;
  const greetingContent = isNewChat ? currentChat[0].content : '';

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 py-3 sm:py-4 md:py-6 lg:py-8 flex flex-col gap-3 sm:gap-4 md:gap-6">
      {isNewChat ? (
        <HeroSection greeting={greetingContent} />
      ) : (
        currentChat && currentChat.map((m, index) => (
          <MessageBubble 
            key={index} 
            role={m.role} 
            content={m.content} 
            timestamp={m.timestamp || m.created_at}
            isLastAssistant={index === lastAssistantIndex}
            onRegenerate={onRegenerate}
            messageIndex={index}
            sessionId={sessionId}
            isGreeting={m.isGreeting}
            onEdit={m.role === 'human' ? onEdit : undefined}
            versions={m.versions}
            currentVersionIndex={m.currentVersionIndex}
            onVersionChange={onVersionChange}
            sources={m.sources}
            usedRetrieval={m.used_retrieval}
          />
        ))
      )}
      {error && (
        <div className="p-3 sm:p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl sm:rounded-2xl flex items-start gap-2 sm:gap-3 text-rose-700 dark:text-rose-300 font-bold text-[11px] sm:text-xs">
          <Info size={14} className="sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" /> 
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
