import React, { useState } from 'react';
import { ExternalLink, FileText, ChevronDown, ChevronUp, Scale, BookOpen, Copy, Check } from 'lucide-react';
import config from '../config.js';

/**
 * SourceCard - Individual source card with clickable link to PDF
 */
const SourceCard = ({ source, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Construct the full URL for the document
  const documentUrl = source.document_url 
    ? `${config.API_BASE_URL}${source.document_url}`
    : null;

  const handleCopyCitation = async () => {
    const citationText = `${source.statutory_reference || source.full_citation}`;
    try {
      await navigator.clipboard.writeText(citationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy citation:', err);
    }
  };

  const handleOpenDocument = () => {
    if (documentUrl) {
      window.open(documentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Header with citation link */}
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Scale size={12} className="sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              {/* Main citation - clickable */}
              <button
                onClick={handleOpenDocument}
                disabled={!documentUrl}
                className={`text-left text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 
                  ${documentUrl ? 'hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer' : 'cursor-default'}
                  transition-colors duration-200 flex items-center gap-1.5`}
              >
                <span className="truncate">{source.section || 'General Provisions'}</span>
                {documentUrl && <ExternalLink size={12} className="flex-shrink-0 opacity-60" />}
              </button>
              
              {/* Act name */}
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {source.act_name}
              </p>
              
              {/* Page reference */}
              {source.page && source.page !== 'N/A' && (
                <p className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  📄 Page {source.page}
                </p>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyCitation}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Copy citation"
            >
              {copied ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <Copy size={14} className="text-slate-400" />
              )}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {expanded ? (
                <ChevronUp size={14} className="text-slate-400" />
              ) : (
                <ChevronDown size={14} className="text-slate-400" />
              )}
            </button>
          </div>
        </div>
        
        {/* Additional sections mentioned */}
        {source.sections_in_content && source.sections_in_content.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {source.sections_in_content.slice(0, 3).map((sec, idx) => (
              <span
                key={idx}
                className="text-[8px] sm:text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-medium"
              >
                {sec}
              </span>
            ))}
            {source.sections_in_content.length > 3 && (
              <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 text-slate-400">
                +{source.sections_in_content.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Expanded content preview */}
      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 border-t border-slate-100 dark:border-slate-700">
          <div className="mt-3 p-2 sm:p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md">
            <p className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-4">
              {source.content_preview}
            </p>
          </div>
          
          {/* Full citation for copying */}
          <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-100 dark:border-emerald-800">
            <p className="text-[8px] sm:text-[9px] text-emerald-700 dark:text-emerald-300 font-mono">
              📚 {source.statutory_reference || source.full_citation}
            </p>
          </div>
          
          {/* View document button */}
          {documentUrl && (
            <button
              onClick={handleOpenDocument}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-bold rounded-md transition-colors"
            >
              <FileText size={14} />
              View Full Document (Page {source.page || 1})
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * SourceCards - Container for displaying multiple source citations
 */
export const SourceCards = ({ sources, isExpanded = false }) => {
  const [showAll, setShowAll] = useState(isExpanded);

  if (!sources || sources.length === 0) {
    return null;
  }

  // Remove duplicates based on full_citation
  const uniqueSources = sources.filter((source, index, self) => 
    index === self.findIndex(s => s.full_citation === source.full_citation)
  );

  const displayedSources = showAll ? uniqueSources : uniqueSources.slice(0, 2);
  const hasMore = uniqueSources.length > 2;

  return (
    <div className="mt-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen size={14} className="text-emerald-600 dark:text-emerald-400" />
        <h4 className="text-[10px] sm:text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          Statutory References ({uniqueSources.length})
        </h4>
      </div>
      
      {/* Source cards */}
      <div className="grid gap-2 sm:gap-3">
        {displayedSources.map((source, index) => (
          <SourceCard key={index} source={source} index={index} />
        ))}
      </div>
      
      {/* Show more/less toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors flex items-center justify-center gap-1"
        >
          {showAll ? (
            <>
              <ChevronUp size={14} />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Show {uniqueSources.length - 2} More References
            </>
          )}
        </button>
      )}
      
      {/* Legal disclaimer */}
      <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-100 dark:border-amber-800">
        <p className="text-[7px] sm:text-[8px] text-amber-700 dark:text-amber-300 font-medium text-center">
          ⚖️ Click on any reference to view the original statutory document
        </p>
      </div>
    </div>
  );
};

export default SourceCards;
