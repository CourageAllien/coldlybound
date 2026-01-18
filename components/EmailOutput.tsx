'use client';

import { useState } from 'react';
import { Copy, Check, RefreshCw, ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, FileDown } from 'lucide-react';
import { downloadAsPDF, downloadAsDOC, downloadSingleEmailAsPDF, downloadSingleEmailAsDOC } from '@/lib/download-utils';

interface Email {
  subject: string;
  body: string;
}

interface EmailOutputProps {
  emails: Email[];
  style: string;
  targetCompany: string;
  onRegenerate: () => void;
  onNewEmail: () => void;
  isRegenerating: boolean;
  transformedWhatWeDo?: string;
  originalWhatWeDo?: string;
}

export default function EmailOutput({ 
  emails, 
  style, 
  targetCompany, 
  onRegenerate,
  onNewEmail,
  isRegenerating,
  transformedWhatWeDo,
  originalWhatWeDo
}: EmailOutputProps) {
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
        background: 'var(--accent-muted)', 
        borderRadius: 12, 
        marginBottom: 24 
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0, 212, 170, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={20} color="var(--accent)" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, color: 'var(--accent)' }}>{emails.length} Emails Generated!</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Using {style} for {targetCompany}</p>
        </div>
      </div>

      {/* What We Do Transformation */}
      {originalWhatWeDo && transformedWhatWeDo && (
        <div style={{ 
          padding: 16, 
          background: 'var(--bg-elevated)', 
          borderRadius: 12, 
          marginBottom: 24,
          border: '1px solid var(--border-subtle)'
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
            ✨ AI TRANSFORMED YOUR VALUE PROPOSITION
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ 
              padding: '8px 12px', 
              background: 'rgba(255, 90, 90, 0.1)', 
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}>
              <span style={{ color: 'var(--error)', marginRight: 6 }}>❌</span>
              &quot;{originalWhatWeDo}&quot;
            </div>
            <span style={{ color: 'var(--brand)', fontSize: 18 }}>→</span>
            <div style={{ 
              padding: '8px 12px', 
              background: 'rgba(0, 212, 170, 0.1)', 
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--accent)',
              fontWeight: 500
            }}>
              <span style={{ marginRight: 6 }}>✅</span>
              &quot;{transformedWhatWeDo}&quot;
            </div>
          </div>
        </div>
      )}

      {/* Email Selector */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 16, 
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
        
        <div style={{ display: 'flex', gap: 8 }}>
          {emails.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: currentIndex === index ? '2px solid var(--brand)' : '1px solid var(--border-subtle)',
                background: currentIndex === index ? 'var(--brand-muted)' : 'var(--bg-elevated)',
                color: currentIndex === index ? 'var(--brand)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 14,
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

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: '10px 16px', background: 'var(--bg-surface)', borderRadius: 10, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Body: </span>
          <span style={{ color: wordCount <= 100 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{wordCount} words</span>
        </div>
        <div style={{ padding: '10px 16px', background: 'var(--bg-surface)', borderRadius: 10, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Subject: </span>
          <span style={{ color: subjectWords <= 4 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{subjectWords} words</span>
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
        className="btn-primary"
        style={{ width: '100%', marginBottom: 12 }}
      >
        {copiedAll ? <Check size={18} /> : <Copy size={18} />}
        {copiedAll ? 'Copied Full Email!' : 'Copy Full Email'}
      </button>

      {/* Download Options */}
      <div style={{ 
        background: 'var(--bg-surface)', 
        borderRadius: 12, 
        padding: 16,
        border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Download Options
        </p>
        
        {/* Download Current Email */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => downloadSingleEmailAsPDF(currentEmail, currentIndex, style, targetCompany)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <FileDown size={16} />
            Email {currentIndex + 1} as PDF
          </button>
          <button
            onClick={() => downloadSingleEmailAsDOC(currentEmail, currentIndex, style, targetCompany)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <FileText size={16} />
            Email {currentIndex + 1} as DOC
          </button>
        </div>

        {/* Download All Emails */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => downloadAsPDF({ emails, filename: 'all-emails', style, targetCompany })}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid var(--brand)',
              background: 'var(--brand-muted)',
              color: 'var(--brand)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Download size={16} />
            All {emails.length} Emails (PDF)
          </button>
          <button
            onClick={() => downloadAsDOC({ emails, filename: 'all-emails', style, targetCompany })}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid var(--brand)',
              background: 'var(--brand-muted)',
              color: 'var(--brand)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Download size={16} />
            All {emails.length} Emails (DOC)
          </button>
        </div>
      </div>
    </div>
  );
}
