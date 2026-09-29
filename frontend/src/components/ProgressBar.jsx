import { useState, useEffect } from 'react';

export default function ProgressBar({ isLoading, isComplete, isStreaming = false }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Extracting & Indexing Standards');

  useEffect(() => {
    if (isLoading) {
      if (isStreaming) {
        setProgress(95);
        setPhase('Streaming Verified Compliance Insights...');
        return;
      }
      setProgress(20);
      setPhase('Retrieving Relevant Clauses (RAG)...');

      const timer1 = setTimeout(() => {
        setProgress(50);
        setPhase('Analyzing Standard Clauses with AI');
      }, 800);

      const timer2 = setTimeout(() => {
        setProgress(75);
        setPhase('Evaluating Compliance Verdict & Tolerances');
      }, 2500);

      const timer3 = setTimeout(() => {
        setProgress(90);
        setPhase('Finalizing Citation References');
      }, 5000);

      const timerSlow = setTimeout(() => {
        setPhase('Synthesizing deep regulatory cross-references (taking a bit longer)...');
      }, 9000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timerSlow);
      };
    } else if (isComplete) {
      setProgress(100);
      setPhase('Complete');
      const resetTimer = setTimeout(() => {
        setProgress(0);
      }, 1000);
      return () => clearTimeout(resetTimer);
    } else {
      setProgress(0);
    }
  }, [isLoading, isComplete, isStreaming]);

  if (!isLoading && progress === 0) return null;

  return (
    <div className="w-full space-y-1.5 animate-fade-in py-1">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="font-semibold text-gold-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gold-400 animate-ping" />
          {phase}
        </span>
        <span className="font-mono font-bold text-gold-300">{progress}%</span>
      </div>
      <div className="w-full h-1.5 bg-navy-900 border border-gold-500/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold-500 to-gold-400 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
