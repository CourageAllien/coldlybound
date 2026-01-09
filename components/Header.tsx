'use client';

import { Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--primary)]/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-[var(--text-primary)]">ColdlyBound</span>
              <span className="hidden sm:inline text-sm text-[var(--text-muted)] ml-2">AI Cold Email Generator</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="badge badge-success">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] mr-2"></span>
              29 Styles Available
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
