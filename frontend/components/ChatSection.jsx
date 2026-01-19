import React from 'react';
import { Info } from 'lucide-react';
import { MessageBubble } from './MessageBubble.jsx';

export const ChatSection = ({ currentChat, error, onRegenerate, sessionId, onEdit, onVersionChange }) => {
  // Find the index of the last assistant message
  const lastAssistantIndex = currentChat 
    ? currentChat.map((m, i) => (m.role === 'assistant' || m.role === 'ai') ? i : -1).filter(i => i >= 0).pop()
    : -1;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-8 md:py-12 flex flex-col gap-4 sm:gap-6 md:gap-10">
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
        />
      ))}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-start gap-3 text-rose-700 dark:text-rose-300 font-bold text-xs">
          <Info size={16} /> {error}
        </div>
      )}
    </div>
  );
};
