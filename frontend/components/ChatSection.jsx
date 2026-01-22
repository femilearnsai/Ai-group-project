
import React from 'react';
import { Info, Loader2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble.jsx';


export const ChatSection = ({ currentChat, error, isLoading, onRegenerate, sessionId, onEdit, onVersionChange }) => {
  // Find the index of the last assistant message
  const lastAssistantIndex = currentChat 
    ? currentChat.map((m, i) => (m.role === 'assistant' || m.role === 'ai') ? i : -1).filter(i => i >= 0).pop()
    : -1;

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 py-3 sm:py-4 md:py-6 lg:py-8 flex flex-col gap-3 sm:gap-4 md:gap-6">
      {currentChat && currentChat.map((m, index) => (
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
      ))}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="animate-spin w-6 h-6 text-emerald-600" />
          <span className="ml-2 text-emerald-600 font-semibold text-xs">Thinking...</span>
        </div>
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
