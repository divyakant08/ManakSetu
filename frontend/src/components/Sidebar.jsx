import { CheckSquare, Square, FileText, CheckCircle2, Layers, Filter } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Sidebar({
  documents = [],
  selectedDocuments = [],
  onToggleDocument,
  onSelectAll,
  onClearAll,
  isOpen = true
}) {
  const { t } = useLanguage();
  const isAllKeyword = selectedDocuments.includes('ALL');
  const selectedSet = new Set(
    isAllKeyword ? documents : selectedDocuments.filter((name) => name && name !== 'ALL')
  );
  const allSelected = documents.length > 0 && selectedSet.size === documents.length;
  const effectiveCount = isAllKeyword ? documents.length : selectedSet.size;

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="w-80 flex-shrink-0 border-r border-gold-500/20 bg-navy-950/95 flex flex-col h-full overflow-hidden transition-all duration-200 shadow-xl">
      {/* Top Header */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-gold-400" />
            {t.repositoryTitle || 'Standards Selector'}
          </h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-gold-500/10 text-gold-400 border border-gold-500/20 font-semibold">
            {effectiveCount}/{documents.length} {t.sidebarSelectedCount || 'selected'}
          </span>
        </div>

        {/* Multi-Select Action Controls */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={allSelected || isAllKeyword ? onClearAll : onSelectAll}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              allSelected || isAllKeyword
                ? 'bg-gold-500/20 text-gold-300 border-gold-500/40 shadow-sm'
                : 'bg-white/5 hover:bg-gold-500/10 text-slate-300 hover:text-gold-300 border-white/10'
            }`}
          >
            {allSelected || isAllKeyword ? (
              <CheckSquare className="w-4 h-4 text-gold-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>{allSelected || isAllKeyword ? (t.sidebarClearAll || 'Clear Selection') : (t.sidebarSelectAll || 'Select All Standards')}</span>
          </button>
        </div>
      </div>

      {/* Interactive Checkbox Standards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
          <span>Active Standards</span>
          <span className="text-[10px] text-gold-400 font-medium">Query Scope</span>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-slate-800 rounded-2xl bg-white/[0.01]">
            <Layers className="w-7 h-7 text-slate-600 mb-1.5" />
            <p className="text-xs font-semibold text-slate-400">{t.noDocsYet || 'No standards indexed'}</p>
            <p className="text-[11px] text-slate-600 mt-0.5 max-w-[180px]">
              {t.noDocsSubtitle || 'Ensure official standards exist in stored_documents.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {documents.map((doc) => {
              const isChecked = selectedSet.has(doc);
              return (
                <li
                  key={doc}
                  onClick={() => onToggleDocument(doc)}
                  className={`group relative flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-gold-500/15 border-gold-500/40 shadow-md shadow-gold-500/5'
                      : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-gold-500/20'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-gold-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isChecked ? 'text-white font-bold' : 'text-slate-300'}`} title={doc}>
                      {doc}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3 text-gold-400/80" />
                      {isChecked ? 'Included in Analysis' : 'Excluded'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer Info Box */}
      <div className="p-3 border-t border-white/5 bg-navy-900/40 text-[11px] text-slate-400 flex items-center justify-between">
        <span>{t.textAggregator || 'Multi-Document Filter'}</span>
        <span className="text-gold-400 font-semibold">{effectiveCount} Active</span>
      </div>
    </aside>
  );
}
