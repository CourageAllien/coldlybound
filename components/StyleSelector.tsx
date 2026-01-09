'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Search, AlertCircle } from 'lucide-react';

interface StyleSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  bestFor: string[];
  tone: string;
}

interface StyleSelectorProps {
  selectedStyle: string | null;
  onStyleSelect: (slug: string) => void;
  error?: string;
}

export default function StyleSelector({ selectedStyle, onStyleSelect, error }: StyleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [styles, setStyles] = useState<StyleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/styles')
      .then(res => res.json())
      .then(setStyles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchRef.current) searchRef.current.focus();
  }, [isOpen]);

  const selected = styles.find(s => s.slug === selectedStyle);
  const filtered = styles.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={dropdownRef}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Email Style <span style={{ color: 'var(--error)' }}>*</span>
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'var(--bg-base)',
          border: `1px solid ${error ? 'var(--error)' : 'var(--border-subtle)'}`,
          borderRadius: 10,
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 15,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.15s ease',
        }}
      >
        <span>{selected ? selected.name : 'Choose a style...'}</span>
        <ChevronDown size={18} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--error)', marginTop: 6 }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {isOpen && (
        <div style={{
          position: 'absolute',
          zIndex: 100,
          width: 'calc(100% - 64px)',
          maxWidth: 616,
          marginTop: 8,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search styles..."
                style={{ paddingLeft: 38, fontSize: 14 }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 340, overflowY: 'auto', padding: 8 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No styles found</div>
            ) : (
              filtered.map(style => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => { onStyleSelect(style.slug); setIsOpen(false); setSearch(''); }}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    marginBottom: 4,
                    background: selectedStyle === style.slug ? 'var(--brand-muted)' : 'transparent',
                    border: selectedStyle === style.slug ? '1px solid var(--brand)' : '1px solid transparent',
                    borderRadius: 10,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                  onMouseEnter={(e) => { if (selectedStyle !== style.slug) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { if (selectedStyle !== style.slug) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{style.name}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                          {style.tone}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {style.description}
                      </p>
                    </div>
                    {selectedStyle === style.slug && <Check size={18} style={{ color: 'var(--brand)', flexShrink: 0 }} />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
