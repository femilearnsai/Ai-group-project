import React, { useState, useRef } from 'react';
import { Play, Pause, Square, Volume2, AlertCircle, ThumbsUp, ThumbsDown, RefreshCw, Copy, Pencil, Check, Share2, Link, X, ChevronLeft, ChevronRight } from 'lucide-react';
import config from '../config.js';

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

export const MessageBubble = ({ role, content, timestamp, onRegenerate, isLastAssistant, messageIndex, sessionId, isGreeting, onEdit, versions, currentVersionIndex, onVersionChange }) => {
  const isUser = role === "human";
  
  // Handle versioned content
  const hasVersions = versions && versions.length > 1;
  const displayContent = hasVersions ? versions[currentVersionIndex || 0]?.content : content;
  const displayTimestamp = hasVersions ? versions[currentVersionIndex || 0]?.timestamp : timestamp;
  
  const formattedContent = !isUser ? parseMarkdown(displayContent) : displayContent;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [feedback, setFeedback] = useState(null); // 'liked' | 'disliked' | null
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);
  const shareMenuRef = useRef(null);
  
  // Format timestamp
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handlePlayVoice = async () => {
    if (isPlaying) {
      // If already playing and not paused, this shouldn't happen (play button hidden)
      return;
    }

    try {
      setTtsError(null);
      
      // If audio already loaded and paused, just resume
      if (audioRef.current && audioRef.current.src && isPaused) {
        audioRef.current.play().catch(err => {
          console.error('Audio resume error:', err);
          setTtsError(err.message || 'Failed to resume audio');
        });
        setIsPlaying(true);
        setIsPaused(false);
        return;
      }

      setIsPlaying(true);
      setIsPaused(false);
      
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      console.log('Requesting TTS from:', config.endpoints.tts);
      
      const response = await fetch(config.endpoints.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, voice: 'alloy' }),  // OpenAI voice
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TTS API error: ${response.status} - ${errorData.detail || response.statusText}`);
      }

      const audioBlob = await response.blob();
      
      // Validate blob is audio
      if (!audioBlob.type.startsWith('audio/')) {
        console.warn('Unexpected response type:', audioBlob.type);
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        
        audioRef.current.onloadedmetadata = () => {
          setDuration(audioRef.current.duration);
        };
        
        audioRef.current.ontimeupdate = () => {
          setCurrentTime(audioRef.current.currentTime);
        };
        
        audioRef.current.onplay = () => {
          setIsPlaying(true);
          setIsPaused(false);
        };
        
        audioRef.current.onpause = () => {
          setIsPaused(true);
        };
        
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTime(0);
          URL.revokeObjectURL(audioUrl);
        };
        
        audioRef.current.onerror = () => {
          setIsPlaying(false);
          setIsPaused(false);
          setTtsError('Audio playback failed');
          URL.revokeObjectURL(audioUrl);
        };
        
        audioRef.current.play().catch(err => {
          console.error('Audio play error:', err);
          setIsPlaying(false);
          setIsPaused(false);
          setTtsError(err.message || 'Failed to play audio');
          URL.revokeObjectURL(audioUrl);
        });
      }
    } catch (error) {
      console.error('Voice playback error:', error);
      if (error.name !== 'AbortError') {
        setTtsError(error.message || 'Voice playback failed');
      }
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const handlePauseVoice = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };

  const handleStopVoice = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentTime(0);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  };

  const formatSeconds = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFeedback = async (type) => {
    if (feedbackLoading) return;
    
    const isRemoving = feedback === type;
    const newFeedback = isRemoving ? null : type;
    
    setFeedbackLoading(true);
    
    try {
      if (isRemoving && sessionId) {
        // Remove feedback
        await fetch(`${config.endpoints.feedback}/${sessionId}/${messageIndex}`, {
          method: 'DELETE',
        });
      } else if (sessionId) {
        // Submit feedback
        await fetch(config.endpoints.feedback, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            message_index: messageIndex,
            feedback_type: type,
            message_content: content
          })
        });
      }
      
      setFeedback(newFeedback);
      console.log(`Feedback ${isRemoving ? 'removed' : 'submitted'}: ${type}`);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      // Still update local state even if API fails
      setFeedback(newFeedback);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (onRegenerate && !isRegenerating) {
      setIsRegenerating(true);
      try {
        await onRegenerate();
      } finally {
        setIsRegenerating(false);
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(content, messageIndex);
    }
  };

  // Generate shareable link
  const getShareableLink = () => {
    const baseUrl = window.location.origin;
    if (sessionId) {
      return `${baseUrl}?session=${sessionId}&msg=${messageIndex}`;
    }
    return baseUrl;
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareableLink());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // Share to social media
  const handleShare = (platform) => {
    const shareUrl = getShareableLink();
    const shareText = content.slice(0, 280); // Limit for Twitter
    const title = 'Nigerian Tax Assistant Response';
    
    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      default:
        return;
    }
    
    window.open(url, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };

  // Close share menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShowShareMenu(false);
      }
    };
    
    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareMenu]);
  
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
      <div className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm border ${
        isUser 
          ? "bg-emerald-600 text-white rounded-br-none border-emerald-700" 
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 opacity-60">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase font-black tracking-widest">
              {isUser ? 'Taxpayer' : 'AI Assistant'}
            </span>
            {!isUser && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePlayVoice}
                  disabled={isPlaying}
                  className={`p-1 rounded transition-all ${
                    ttsError 
                      ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-not-allowed' 
                      : isPlaying
                      ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                  }`}
                  title={ttsError ? `Error: ${ttsError}` : isPlaying ? "Playing..." : isPaused ? "Resume" : "Play voice"}
                >
                  {ttsError ? <AlertCircle size={12} /> : <Play size={12} />}
                </button>
                
                {isPlaying && (
                  <button
                    onClick={handlePauseVoice}
                    className="p-1 rounded transition-all hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    title="Pause"
                  >
                    <Pause size={12} />
                  </button>
                )}
                
                {(isPlaying || isPaused) && (
                  <button
                    onClick={handleStopVoice}
                    className="p-1 rounded transition-all hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-600 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 cursor-pointer"
                    title="Stop"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                )}
              </div>
            )}
          </div>
          {timestamp && (
            <span className="text-[8px] font-bold tracking-wide">
              {formatTime(timestamp)}
            </span>
          )}
        </div>
        
        {(isPlaying || isPaused) && (
          <div className="mb-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden cursor-pointer group"
                onClick={(e) => {
                  if (audioRef.current && duration) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    audioRef.current.currentTime = percent * duration;
                  }
                }}
              >
                <div 
                  className="h-full bg-emerald-500 group-hover:bg-emerald-600 transition-colors"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {formatSeconds(currentTime)} / {formatSeconds(duration)}
              </span>
            </div>
          </div>
        )}
        
        {ttsError && (
          <div className="text-[8px] text-rose-500 dark:text-rose-400 mb-2 flex items-center gap-1">
            <AlertCircle size={10} /> {ttsError}
          </div>
        )}
        <audio ref={audioRef} style={{ display: 'none' }} crossOrigin="anonymous" />
        {isUser ? (
          <div className="whitespace-pre-wrap break-words font-medium">
            {content}
          </div>
        ) : (
          <div 
            className="break-words font-medium markdown-content dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        )}
        
        {/* Version toggle for regenerated responses */}
        {!isUser && hasVersions && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => onVersionChange && onVersionChange(messageIndex, Math.max(0, (currentVersionIndex || 0) - 1))}
              disabled={(currentVersionIndex || 0) === 0}
              className={`p-1.5 rounded-lg transition-all ${
                (currentVersionIndex || 0) === 0
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
              title="Previous version"
            >
              <ChevronLeft size={16} />
            </button>
            
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {(currentVersionIndex || 0) + 1} / {versions.length}
            </span>
            
            <button
              onClick={() => onVersionChange && onVersionChange(messageIndex, Math.min(versions.length - 1, (currentVersionIndex || 0) + 1))}
              disabled={(currentVersionIndex || 0) === versions.length - 1}
              className={`p-1.5 rounded-lg transition-all ${
                (currentVersionIndex || 0) === versions.length - 1
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
              title="Next version"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        
        {/* Edit and Copy buttons for user messages */}
        {isUser && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-emerald-500/30">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all text-emerald-100/70 hover:bg-emerald-500/30 hover:text-white"
              title={copied ? "Copied!" : "Copy message"}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            
            {onEdit && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all text-emerald-100/70 hover:bg-emerald-500/30 hover:text-white"
                title="Edit and resend"
              >
                <Pencil size={12} />
                <span>Edit</span>
              </button>
            )}
          </div>
        )}
        
        {/* Feedback buttons for AI responses (hidden for greeting messages) */}
        {!isUser && !isGreeting && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => handleFeedback('liked')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                feedback === 'liked'
                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
              title="This was helpful"
            >
              <ThumbsUp size={12} fill={feedback === 'liked' ? 'currentColor' : 'none'} />
              {feedback === 'liked' && <span>Helpful</span>}
            </button>
            
            <button
              onClick={() => handleFeedback('disliked')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                feedback === 'disliked'
                  ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
              title="This wasn't helpful"
            >
              <ThumbsDown size={12} fill={feedback === 'disliked' ? 'currentColor' : 'none'} />
              {feedback === 'disliked' && <span>Not helpful</span>}
            </button>
            
            {onRegenerate && (
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ml-auto ${
                  isRegenerating
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
                title="Regenerate response"
              >
                <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
              </button>
            )}
            
            {/* Share button */}
            <div className="relative" ref={shareMenuRef}>
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-purple-600 dark:hover:text-purple-400"
                title="Share response"
              >
                <Share2 size={12} />
                <span>Share</span>
              </button>
              
              {/* Share dropdown menu */}
              {showShareMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Share via</span>
                    <button onClick={() => setShowShareMenu(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      <X size={12} />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => handleShare('twitter')}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    X (Twitter)
                  </button>
                  
                  <button
                    onClick={() => handleShare('linkedin')}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </button>
                  
                  <button
                    onClick={() => handleShare('whatsapp')}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>
                  
                  <button
                    onClick={() => handleShare('facebook')}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </button>
                  
                  <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                    <button
                      onClick={handleCopyLink}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                    >
                      {linkCopied ? <Check size={14} className="text-emerald-500" /> : <Link size={14} />}
                      {linkCopied ? 'Link Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
