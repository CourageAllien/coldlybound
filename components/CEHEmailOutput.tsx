'use client';

import { useState } from 'react';
import { Copy, Check, RefreshCw, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

interface Email {
  subject: string;
  body: string;
}

interface CEHEmailOutputProps {
  emails: Email[];
  style: string;
  targetCompany: string;
  onRegenerate: () => void;
  onNewEmail: () => void;
  isRegenerating: boolean;
}

export default function CEHEmailOutput({ 
  emails, 
  style, 
  targetCompany, 
  onRegenerate,
  onNewEmail,
  isRegenerating 
}: CEHEmailOutputProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const currentEmail = emails[currentIndex];

  const copy = async (text: string, type: 'subject' | 'body' | 'all') => {
    await navigator.clipboard.writeText(text);
    if (type === 'subject') { setCopiedSubject(true); setTimeout(() => setCopiedSubject(false), 2000); }
    if (type === 'body') { setCopiedBody(true); setTimeout(() => setCopiedBody(false), 2000); }
    if (type === 'all') { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000); }
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? emails.length - 1 : prev - 1));
    setCopiedSubject(false);
    setCopiedBody(false);
    setCopiedAll(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === emails.length - 1 ? 0 : prev + 1));
    setCopiedSubject(false);
    setCopiedBody(false);
    setCopiedAll(false);
  };

  const wordCount = currentEmail.body.split(/\s+/).filter(w => w).length;
  const subjectWords = currentEmail.subject.split(/\s+/).filter(w => w).length;
  const firstLine = currentEmail.body.split('\n')[0] || '';
  const firstLineWords = firstLine.split(/\s+/).filter(w => w).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={onNewEmail} className="btn-secondary">
          <ArrowLeft size={16} />
          New Email
        </button>
        <button onClick={onRegenerate} className="btn-secondary" disabled={isRegenerating}>
          <RefreshCw size={16} className={isRegenerating ? 'animate-spin' : ''} />
          Regenerate All
        </button>
      </div>

      {/* Success Banner */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        padding: 16, 
        background: 'rgba(245, 158, 11, 0.15)', 
        borderRadius: 12, 
        marginBottom: 24 
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={20} color="#f59e0b" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, color: '#f59e0b' }}>{emails.length} CEH Emails Generated!</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Using {style} for {targetCompany}</p>
        </div>
      </div>

      {/* Email Selector */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 12, 
        marginBottom: 24,
        padding: 16,
        background: 'var(--bg-surface)',
        borderRadius: 12,
      }}>
        <button 
          onClick={goToPrev}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {emails.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: currentIndex === index ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
                background: currentIndex === index ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-elevated)',
                color: currentIndex === index ? '#f59e0b' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {index + 1}
            </button>
          ))}
        </div>
        
        <button 
          onClick={goToNext}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Stats - CEH specific */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>Body: </span>
          <span style={{ color: wordCount <= 80 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{wordCount}/80</span>
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>Subject: </span>
          <span style={{ color: subjectWords <= 4 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{subjectWords} words</span>
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>1st Line: </span>
          <span style={{ color: firstLineWords <= 12 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{firstLineWords}/12</span>
        </div>
      </div>

      {/* Email Card */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
        {/* Subject */}
        <div style={{ padding: 24, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Subject Line</span>
            <button 
              onClick={() => copy(currentEmail.subject, 'subject')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
            >
              {copiedSubject ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
              {copiedSubject ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{currentEmail.subject}</p>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email Body</span>
            <button 
              onClick={() => copy(currentEmail.body, 'body')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
            >
              {copiedBody ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
              {copiedBody ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ padding: 20, background: 'var(--bg-base)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{currentEmail.body}</p>
          </div>
        </div>
      </div>

      {/* Copy All */}
      <button 
        onClick={() => copy(`Subject: ${currentEmail.subject}\n\n${currentEmail.body}`, 'all')}
        style={{ 
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          color: 'white',
          fontWeight: 600,
          fontSize: 15,
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
        }}
      >
        {copiedAll ? <Check size={18} /> : <Copy size={18} />}
        {copiedAll ? 'Copied Full Email!' : 'Copy Full Email'}
      </button>
    </div>
  );
}
