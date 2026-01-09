'use client';

import { Loader2 } from 'lucide-react';

export default function CEHLoadingState() {
  return (
    <div className="animate-fade-up" style={{ 
      background: 'var(--bg-elevated)', 
      border: '1px solid var(--border-subtle)',
      borderRadius: 16, 
      padding: 64,
      textAlign: 'center'
    }}>
      <div style={{ 
        width: 64, 
        height: 64, 
        borderRadius: 16, 
        background: 'rgba(245, 158, 11, 0.15)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        margin: '0 auto 24px'
      }}>
        <Loader2 size={28} color="#f59e0b" className="animate-spin" />
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
        Generating 8 CEH emails...
      </h3>
      <p style={{ color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
        Crafting high-converting cold emails with pain-point focused copy under 80 words.
      </p>
    </div>
  );
}
