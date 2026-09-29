import { useState, useEffect, useCallback } from 'react';
import { FileBarChart, Scale, ScanLine, BarChart3, Database, ShieldAlert } from 'lucide-react';
import { getDocuments } from './services/api';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SearchTab from './pages/SearchTab';
import GapAnalysisTab from './pages/GapAnalysisTab';
import SummaryTab from './pages/SummaryTab';
import PenaltiesTab from './pages/PenaltiesTab';
import CMLScannerTab from './pages/CMLScannerTab';
import AnalyticsDashboard from './pages/AnalyticsDashboard';

const AVAILABLE_DOCS_KEY = 'manaksetu_available_documents';
const SELECTED_DOCS_KEY = 'manaksetu_selected_documents';

function readStoredList(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

function reconcileSelection(prev, docs) {
  if (prev.includes('ALL')) return ['ALL'];
  const available = new Set(docs);
  return prev.filter((name) => name && name !== 'ALL' && available.has(name));
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('standards');
  const [documents, setDocuments] = useState(() => readStoredList(AVAILABLE_DOCS_KEY, []));
  const [selectedDocuments, setSelectedDocuments] = useState(() =>
    readStoredList(SELECTED_DOCS_KEY, ['ALL'])
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { t } = useLanguage();

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await getDocuments();
      const remoteDocs = data.documents || [];
      const cachedDocs = readStoredList(AVAILABLE_DOCS_KEY, []);
      const nextDocs =
        remoteDocs.length === 0 && cachedDocs.length > 0 ? cachedDocs : remoteDocs;
      setDocuments(nextDocs);
      setSelectedDocuments((selected) => reconcileSelection(selected, nextDocs));
    } catch {
      // Backend booting — keep cached master list visible
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    writeStoredList(AVAILABLE_DOCS_KEY, documents);
  }, [documents]);

  useEffect(() => {
    writeStoredList(SELECTED_DOCS_KEY, selectedDocuments);
  }, [selectedDocuments]);

  const handleToggleDocument = (doc) => {
    setSelectedDocuments((prev) => {
      const selectedSet = new Set(
        prev.includes('ALL') ? documents : prev.filter((name) => name && name !== 'ALL')
      );
      if (selectedSet.has(doc)) {
        selectedSet.delete(doc);
      } else {
        selectedSet.add(doc);
      }
      if (documents.length > 0 && selectedSet.size === documents.length) {
        return ['ALL'];
      }
      return Array.from(selectedSet);
    });
  };

  const handleSelectAll = () => {
    setSelectedDocuments(['ALL']);
  };

  const handleClearAll = () => {
    setSelectedDocuments([]);
  };

  const hasDocuments = documents.length > 0;

  // Exact 6 crisp tabs
  const TABS = [
    { 
      id: 'standards', 
      label: t.tab_standards || 'Standards', 
      icon: Database, 
      description: t.tab_standards_desc || 'Query BIS standards or upload documents' 
    },
    { 
      id: 'gap_analysis', 
      label: t.tab_gap_analysis || 'Gap Analysis', 
      icon: ShieldAlert, 
      description: t.tab_gap_desc || 'Review product technical specs against mandatory limits' 
    },
    { 
      id: 'summary', 
      label: t.tab_summary || 'Summary', 
      icon: FileBarChart, 
      description: t.tab_summary_desc || 'Generate executive regulatory digest across standards' 
    },
    { 
      id: 'penalties', 
      label: t.tab_penalties || 'Penalties', 
      icon: Scale, 
      description: t.tab_penalties_desc || 'Assess legal liabilities under BIS Act 2016' 
    },
    { 
      id: 'cml_scanner', 
      label: t.tab_cml_scanner || 'CM/L Scanner', 
      icon: ScanLine, 
      description: t.tab_cml_desc || 'Inspect product labels and verify CM/L license authenticity' 
    },
    { 
      id: 'analytics', 
      label: t.tab_analytics || 'Analytics', 
      icon: BarChart3, 
      description: t.tab_analytics_desc || 'Compliance health KPIs and regulatory telemetry' 
    },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'standards':
        return <SearchTab documents={documents} selectedDocuments={selectedDocuments} />;
      case 'gap_analysis':
        return <GapAnalysisTab hasDocuments={hasDocuments} documents={documents} />;
      case 'summary':
        return <SummaryTab documents={documents} selectedDocuments={selectedDocuments} />;
      case 'penalties':
        return <PenaltiesTab documents={documents} selectedDocuments={selectedDocuments} />;
      case 'cml_scanner':
        return <CMLScannerTab />;
      case 'analytics':
        return <AnalyticsDashboard />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-navy-950 text-slate-100 font-sans">
      {/* Enterprise Header */}
      <Navbar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        documentCount={documents.length}
      />

      {/* Main Body Layout (Sidebar + Tab Workspace) */}
      <div className="flex flex-1 h-[calc(100%-60px)] overflow-hidden relative">
        {/* Left Multi-Select Standards Sidebar */}
        <Sidebar 
          documents={documents}
          selectedDocuments={selectedDocuments}
          onToggleDocument={handleToggleDocument}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
          isOpen={isSidebarOpen}
        />

        {/* Right Tab Content Container */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-navy-950/60">
          {/* Top Tab Bar Strip */}
          <div className="flex-shrink-0 bg-navy-900/90 border-b border-gold-500/20 px-3 sm:px-6 shadow-md backdrop-blur-md">
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-gold-500/15 text-gold-300 border border-gold-500/40 shadow-lg shadow-gold-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-gold-400' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>

                    {/* Active Underline Glow */}
                    {isActive && (
                      <span className="absolute -bottom-2 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-gold-400 to-gold-500 shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Tab Viewport Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
            <div className="max-w-6xl mx-auto w-full pb-10">
              {renderTab()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
