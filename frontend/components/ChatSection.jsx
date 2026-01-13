import React from 'react';
import { Info } from 'lucide-react';
import { MessageBubble } from './MessageBubble.jsx';

export const ChatSection = ({ currentChat, error }) => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10">
      {currentChat && currentChat.map((m, index) => (
        <MessageBubble key={index} role={m.role} content={m.content} timestamp={m.timestamp || m.created_at} />
      ))}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-700 font-bold text-xs">
          <Info size={16} /> {error}
        </div>
      )}
    </div>
  );
};
