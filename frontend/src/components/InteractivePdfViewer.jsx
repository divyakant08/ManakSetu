import { useState, useEffect } from 'react';
import { X, ExternalLink, FileText } from 'lucide-react';
import { getDocumentViewUrl } from '../services/api';

export default function InteractivePdfViewer({ docName, initialPage = 1, onClose }) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  useEffect(() => {
    if (initialPage) {
      setCurrentPage(initialPage);
    }
  }, [initialPage, docName]);

  if (!docName) return null;

  const pdfUrl = getDocumentViewUrl(docName, currentPage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-6xl h-[92vh] flex flex-col rounded-xl bg-white border border-slate-300 shadow-2xl overflow-hidden text-slate-800">
        
        {/* Viewer Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate" title={docName}>
                {docName}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Official BIS Standard Specification Document
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Page Jump */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-600 font-medium">Page:</span>
              <input
                type="number"
                min="1"
                value={currentPage}
                onChange={(e) => setCurrentPage(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center text-slate-900 font-bold focus:outline-none"
              />
            </div>

            {/* Open in New Tab */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors"
              title="Open full PDF in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 border border-slate-200 text-slate-600 hover:text-red-700 transition-colors cursor-pointer"
              title="Close Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Embedded PDF Viewport */}
        <div className="flex-1 w-full h-full bg-slate-100 relative">
          <iframe
            key={`${docName}-${currentPage}`}
            src={pdfUrl}
            title={`PDF Preview - ${docName}`}
            className="w-full h-full border-0"
          />
        </div>

        {/* Viewer Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
          <span>Active Citation View: <strong className="text-blue-700">Page {currentPage}</strong></span>
          <span className="text-[11px] text-slate-500">Bureau of Indian Standards Central Repository</span>
        </div>
      </div>
    </div>
  );
}
