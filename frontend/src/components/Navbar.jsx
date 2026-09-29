import { Shield, Globe, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar({ isSidebarOpen, setIsSidebarOpen, documentCount = 0 }) {
  const { language, setLanguage, t, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selected = languages.find((l) => l.code === language) || languages[0];

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="flex-shrink-0 z-40 bg-navy-950 border-b border-gold-500/20 shadow-xl shadow-black/40">
      {/* Indian National Tricolor Accent Top Stripe */}
      <div className="tricolor-strip h-[3px] w-full" />

      {/* Main Navbar Bar */}
      <div className="w-full px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left Side: Sidebar Toggle & Brand Identity */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-xl bg-white/5 hover:bg-gold-500/10 border border-white/10 hover:border-gold-500/30 text-slate-300 hover:text-gold-400 transition-colors focus:outline-none cursor-pointer"
            title={isSidebarOpen ? "Collapse Standards Repository" : "Open Standards Repository"}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4 text-gold-400" />}
          </button>

          {/* BIS National Crest / Emblem */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 border border-gold-500/30 text-gold-400 shadow-md shadow-gold-500/10 flex-shrink-0">
              <Shield className="w-5 h-5" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-navy-950" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span className="text-gold-400">{t.portalShortTitle}</span>
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-500/10 border border-gold-500/30 text-gold-300 uppercase tracking-wider">
                  {t.enterpriseBadge}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
                {t.motto}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Status Badge, Document Counter & Language Selector */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active AI Engine Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-900/80 border border-white/10 text-xs text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] text-slate-400">{t.modelLabel}:</span>
            <span className="text-[11px] font-bold text-gold-400">{t.modelName}</span>
          </div>

          {/* Standards Active Count */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-slate-400 font-medium">{t.activeCount}:</span>
            <span className={`px-1.5 py-0.2 rounded font-bold ${documentCount > 0 ? 'bg-gold-500/20 text-gold-400' : 'bg-slate-700 text-slate-400'}`}>
              {documentCount}
            </span>
          </div>

          {/* Language Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-gold-500/10 hover:border-gold-500/30 transition-all text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" />
              <span>{selected.flag} {selected.native}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-navy-900 shadow-2xl z-50 py-1.5 border border-gold-500/30 animate-fade-in divide-y divide-white/5">
                <div className="px-3 py-1.5 text-[10px] font-bold text-gold-400 uppercase tracking-wider">
                  {t.selectLanguage}
                </div>
                <div className="py-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setOpen(false); }}
                      className={`w-full text-left px-3.5 py-2 text-xs hover:bg-gold-500/10 transition-colors flex items-center justify-between cursor-pointer ${
                        lang.code === language ? 'text-gold-400 font-bold bg-gold-500/10' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{lang.flag}</span>
                        <span>{lang.native}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{lang.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
