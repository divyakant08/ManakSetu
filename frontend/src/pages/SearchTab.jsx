import { useState, useRef, useCallback } from 'react';
import { Search, Sparkles, AlertCircle, Database, FileUp, UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { searchPreloadQuery, searchCustomQuery } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { createSpeechRecognition } from '../utils/speech';
import ProgressBar from '../components/ProgressBar';
import ResultCard from '../components/ResultCard';
import InteractivePdfViewer from '../components/InteractivePdfViewer';
import MicButton from '../components/MicButton';

const QUICK_PROMPTS_MAP = {
  English: [
    { label: '💧 Water Microbiological Limits', query: 'What are the mandatory microbiological and chemical testing limits in IS 14543 for packaged drinking water?' },
    { label: '🏷️ CM/L Labeling Requirements', query: 'What are the exact BIS CM/L marking and labeling requirements specified for packaging?' },
    { label: '⚡ Shelf Life & Expiry Rules', query: 'What are the mandatory expiration, storage, and date coding clauses?' },
    { label: '🔬 Lab Testing Frequency', query: 'What is the mandatory frequency for in-house laboratory testing vs external BIS recognized labs?' },
    { label: '🚨 Non-Compliance Penalties', query: 'What are the legal liabilities and penalty clauses under BIS Act 2016 for sub-standard production?' },
  ],
  Hindi: [
    { label: '💧 पानी सूक्ष्मजीव सीमाएं', query: 'IS 14543 में पैकेज्ड पेयजल के लिए अनिवार्य माइक्रोबायोलॉजिकल और रासायनिक परीक्षण सीमाएं क्या हैं?' },
    { label: '🏷️ CM/L लेबलिंग', query: 'पैकेजिंग पर बीआईएस CM/L मार्किंग और लेबलिंग के सटीक नियम क्या हैं?' },
    { label: '⚡ शेल्फ लाइफ', query: 'अनिवार्य समाप्ति तिथि, भंडारण और डेट कोडिंग खंड क्या हैं?' },
    { label: '🔬 परीक्षण आवृत्ति', query: 'इन-हाउस लैब परीक्षण बनाम बाहरी बीआईएस मान्यता प्राप्त लैब के लिए अनिवार्य आवृत्ति क्या है?' },
    { label: '🚨 दंड', query: 'मानक से कम उत्पादन के लिए बीआईएस अधिनियम 2016 के तहत कानूनी देनदारियां और दंड क्या हैं?' },
  ],
  Marathi: [
    { label: '💧 पाणी सूक्ष्मजीव', query: 'IS 14543 मध्ये पॅकेज केलेल्या पिण्याच्या पाण्यासाठी अनिवार्य सूक्ष्मजीव मर्यादा काय आहेत?' },
    { label: '🏷️ CM/L लेबलिंग', query: 'पॅकेजिंगवर बीआयएस CM/L मार्किंग नियम काय आहेत?' },
    { label: '⚡ शेल्फ लाइफ', query: 'अनिवार्य कालबाह्यता तारीख आणि डेट कोडिंग कलम काय आहेत?' },
    { label: '🔬 चाचणी वारंवारता', query: 'इन-हाउस लॅब चाचणी विरूद्ध बाह्य बीआयएस लॅबसाठी अनिवार्य वारंवारता काय आहे?' },
    { label: '🚨 दंड', query: 'कमी दर्जाच्या उत्पादनासाठी बीआयएस कायदा 2016 अंतर्गत दंड काय आहेत?' },
  ],
};

export default function SearchTab({ documents = [], selectedDocuments = [] }) {
  const { language, t } = useLanguage();
  const [searchMode, setSearchMode] = useState('bis'); // 'bis' | 'upload'
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [complete, setComplete] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [viewerPage, setViewerPage] = useState(1);
  const [isListening, setIsListening] = useState(false);

  // Upload mode states
  const [customFile, setCustomFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const recognitionRef = useRef(null);

  const quickPrompts = QUICK_PROMPTS_MAP[language] || QUICK_PROMPTS_MAP['English'];

  const handleSearch = async (searchPrompt) => {
    const q = searchPrompt || query;
    if (!q.trim()) return;

    if (searchMode === 'upload' && !customFile) {
      setError('Please upload a custom PDF document first.');
      return;
    }

    if (searchMode === 'bis' && selectedDocuments.length === 0) {
      setError(t.noDocsWarningTitle || 'No standards selected. Please select at least one standard in the sidebar.');
      return;
    }

    setLoading(true);
    setStreaming(false);
    setComplete(false);
    setError(null);
    setResult(null);

    const handlers = {
      onMeta: (meta) => {
        setResult((prev) => ({
          ...(prev || {}),
          ...meta,
          response: prev?.response || '',
        }));
      },
      onDelta: (assembled) => {
        setStreaming(true);
        setResult((prev) => ({
          ...(prev || {}),
          response: assembled,
        }));
      },
    };

    try {
      if (searchMode === 'bis') {
        const data = await searchPreloadQuery(q, language, selectedDocuments, false, handlers);
        setResult(data);
      } else {
        const data = await searchCustomQuery(customFile, q, language, handlers);
        setResult(data);
      }
      setComplete(true);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Search analysis failed.');
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const handleCitationClick = (docName, page) => {
    const target = result?.temp_file || docName;
    setViewerDoc(target);
    setViewerPage(page);
  };

  const handleFileSelect = (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF file.');
      return;
    }
    setCustomFile(file);
    setError(null);
    setResult(null);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleMicClick = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = createSpeechRecognition(language);
    if (!recognition) {
      setError(t.micNotSupported);
      return;
    }

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setQuery(text);
    };
    recognition.onend = () => {
      setIsListening(false);
      setTimeout(() => {
        const input = document.getElementById('search-query-input');
        if (input && input.value.trim()) {
          handleSearch(input.value.trim());
        }
      }, 200);
    };
    recognition.onerror = (e) => {
      setIsListening(false);
      if (e.error !== 'no-speech') setError(`Microphone error: ${e.error}`);
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch {}
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header Banner */}
      <div className="enterprise-card-elevated p-6 sm:p-7 border-l-4 border-l-gold-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold uppercase tracking-wider mb-2">
              {searchMode === 'bis' ? <Database className="w-3.5 h-3.5" /> : <FileUp className="w-3.5 h-3.5" />}
              <span>{searchMode === 'bis' ? (t.searchModeBis || 'BIS Knowledge Base') : (t.searchModeUpload || 'Upload & Query')}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {t.searchBannerTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              {t.searchBannerDesc}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="px-3 py-1.5 rounded-xl bg-navy-950/80 border border-gold-500/30 text-xs text-gold-300 font-mono shadow-sm">
              {searchMode === 'bis' ? `${selectedDocuments.includes('ALL') ? documents.length : selectedDocuments.length} Standards In Scope` : 'Ad-Hoc PDF Mode'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Search Card with Segmented Mode Switch */}
      <div className="enterprise-card p-5 sm:p-6 space-y-5">
        
        {/* Segmented Mode Switch Toggle */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="inline-flex p-1 rounded-xl bg-navy-950 border border-white/10 shadow-inner">
            <button
              onClick={() => { setSearchMode('bis'); setError(null); setResult(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'bis'
                  ? 'bg-gradient-to-r from-gold-500 to-gold-400 text-navy-950 shadow-md shadow-gold-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{t.searchModeBis || 'BIS Knowledge Base'}</span>
            </button>
            <button
              onClick={() => { setSearchMode('upload'); setError(null); setResult(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'upload'
                  ? 'bg-gradient-to-r from-gold-500 to-gold-400 text-navy-950 shadow-md shadow-gold-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>{t.searchModeUpload || 'Upload & Query'}</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {searchMode === 'bis' ? 'Querying official indexed Indian Standards' : 'Isolated ad-hoc custom document Q&A'}
          </span>
        </div>

        {/* Upload Mode Inline Dropzone (Only visible in 'upload' mode) */}
        {searchMode === 'upload' && (
          <div className="space-y-3 animate-fade-in">
            <label
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                isDragging
                  ? 'border-gold-400 bg-gold-500/10 scale-[0.99]'
                  : customFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-gold-500/50 bg-navy-950/60'
              }`}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              {customFile ? (
                <div className="flex flex-col items-center text-center space-y-1.5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white truncate max-w-sm">{customFile.name}</p>
                    <p className="text-[11px] text-slate-400">{(customFile.size / (1024 * 1024)).toFixed(2)} MB • {t.customReady || 'Ready for interrogation'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCustomFile(null); setResult(null); }}
                    className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[10px] font-bold"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center space-y-1.5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gold-500/10 text-gold-400">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-200">
                    {t.dropCustomPdf || 'Drop custom PDF here or click to browse'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Proprietary test reports, vendor manuals, or third-party certifications
                  </p>
                </div>
              )}
            </label>
          </div>
        )}

        {/* Search Input Bar with Embedded Mic */}
        <div className="relative flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-400" />
              <input
                id="search-query-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={searchMode === 'bis' ? t.searchPlaceholder : (t.customSearchPlaceholder || 'Ask a question about this custom document...')}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-navy-950/90 border border-gold-500/30 focus:border-gold-400 focus:ring-1 focus:ring-gold-400 text-xs sm:text-sm text-slate-100 placeholder-slate-400 shadow-inner"
              />
            </div>
            <MicButton
              isListening={isListening}
              onClick={handleMicClick}
              disabled={loading || (searchMode === 'upload' && !customFile)}
              title={isListening ? t.listening : 'Voice Search'}
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim() || (searchMode === 'upload' && !customFile)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-navy-950 font-extrabold text-xs sm:text-sm shadow-md shadow-gold-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer flex-shrink-0"
          >
            {loading ? <span className="animate-spin">⏳</span> : <Sparkles className="w-4 h-4" />}
            <span>{loading ? t.btnAnalyzing : t.btnAnalyze}</span>
          </button>
        </div>

        {/* Quick Regulatory Chips (BIS mode) */}
        {searchMode === 'bis' && (
          <div className="pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              {t.quickPromptsTitle}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(prompt.query);
                    handleSearch(prompt.query);
                  }}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl bg-navy-950/80 hover:bg-gold-500/10 border border-white/5 hover:border-gold-500/30 text-xs text-slate-300 hover:text-gold-300 transition-all text-left cursor-pointer disabled:opacity-40"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <ProgressBar isLoading={loading} isComplete={complete} isStreaming={streaming} />

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3 text-xs sm:text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          <ResultCard
            title={searchMode === 'bis' ? `BIS Analysis (${language})` : `Custom Analysis: ${result.filename}`}
            content={result.response}
            docNames={result.documents_searched || (result.filename ? [result.filename] : documents)}
            onCitationClick={handleCitationClick}
          />
        </div>
      )}

      {/* Interactive PDF Viewer Modal */}
      {viewerDoc && (
        <InteractivePdfViewer
          docName={viewerDoc}
          initialPage={viewerPage}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </div>
  );
}
