import React from 'react';

// Simple markdown parser for basic formatting
const parseMarkdown = (text) => {
  if (!text) return '';
  
  let html = text;
  
  // Code blocks (```code```)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto my-2 text-xs"><code>$2</code></pre>');
  
  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
  
  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-black">$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong class="font-black">$1</strong>');
  
  // Italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em class="italic">$1</em>');
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-black mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-black mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-black mt-4 mb-2">$1</h1>');
  
  // Unordered lists (- or *)
  html = html.replace(/^\* (.+)$/gim, '<li class="ml-4">• $1</li>');
  html = html.replace(/^- (.+)$/gim, '<li class="ml-4">• $1</li>');
  
  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gim, '<li class="ml-4 list-decimal">$1</li>');
  
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-emerald-600 underline hover:text-emerald-700" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Line breaks
  html = html.replace(/\n/g, '<br/>');
  
  return html;
};

export const MessageBubble = ({ role, content }) => {
  const isUser = role === "human";
  const formattedContent = !isUser ? parseMarkdown(content) : content;
  
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
      <div className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm border ${
        isUser 
          ? "bg-emerald-600 text-white rounded-br-none border-emerald-700" 
          : "bg-white border-slate-200 text-slate-800 rounded-bl-none"
      }`}>
        <div className="flex items-center gap-2 mb-2 opacity-60">
          <span className="text-[9px] uppercase font-black tracking-widest">
            {isUser ? 'Taxpayer' : 'AI Assistant'}
          </span>
        </div>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words font-medium">
            {content}
          </div>
        ) : (
          <div 
            className="break-words font-medium markdown-content"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        )}
      </div>
    </div>
  );
};
