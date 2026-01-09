'use client';

import { useState } from 'react';
import CEHForm from '@/components/CEHForm';
import CEHEmailOutput from '@/components/CEHEmailOutput';
import CEHLoadingState from '@/components/CEHLoadingState';
import { AlertCircle, Sparkles, RefreshCw, Settings } from 'lucide-react';
import Link from 'next/link';

interface Email {
  subject: string;
  body: string;
}

interface GeneratedResult {
  emails: Email[];
  style: string;
  targetCompany: string;
}

export default function CEHPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [lastFormData, setLastFormData] = useState<FormData | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    setLastFormData(formData);

    try {
      const response = await fetch('/api/ceh-generate', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate emails');
      }

      setGeneratedResult({
        emails: result.emails,
        style: result.style,
        targetCompany: result.targetCompany,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (lastFormData) handleSubmit(lastFormData);
  };

  const handleReset = () => {
    setGeneratedResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header style={{ 
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(12, 12, 15, 0.8)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 12, 
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
            }}>
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>CEH</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 8 }}>Cold Email Hub</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link 
              href="/ceh-admin"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px', 
                borderRadius: 10, 
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <Settings size={14} />
              Templates
            </Link>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px', 
              borderRadius: 24, 
              background: 'rgba(245, 158, 11, 0.15)', 
              color: '#f59e0b',
              fontSize: 13,
              fontWeight: 500
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }}></span>
              8 Emails
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>
        
        {generatedResult && generatedResult.emails.length > 0 ? (
          <div className="animate-fade-up">
            <CEHEmailOutput
              emails={generatedResult.emails}
              style={generatedResult.style}
              targetCompany={generatedResult.targetCompany}
              onRegenerate={handleRegenerate}
              onNewEmail={handleReset}
              isRegenerating={isLoading}
            />
          </div>
        ) : isLoading ? (
          <CEHLoadingState />
        ) : error ? (
          <div className="animate-fade-up" style={{ 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border-subtle)',
            borderRadius: 16, 
            padding: 48,
            textAlign: 'center'
          }}>
            <div style={{ 
              width: 64, 
              height: 64, 
              borderRadius: 16, 
              background: 'rgba(255, 90, 90, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <AlertCircle size={28} color="var(--error)" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Generation Failed</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{error}</p>
            <button onClick={handleReset} className="btn-secondary">
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        ) : (
          <div className="animate-fade-up">
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h1 style={{ fontSize: 40, fontWeight: 700, marginBottom: 12, lineHeight: 1.2 }}>
                <span style={{ color: '#f59e0b' }}>CEH</span>
                <span style={{ color: 'var(--text-primary)' }}> Email Generator</span>
              </h1>
              <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
                Generate 8 high-converting cold emails with proven pain-point frameworks.
              </p>
            </div>

            {/* Rules Card */}
            <div style={{ 
              background: 'rgba(245, 158, 11, 0.1)', 
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 12, 
              padding: 20,
              marginBottom: 24
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b', marginBottom: 12 }}>CEH Copy Rules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div>• First line: 12 words max</div>
                <div>• Subject: 3 words + company</div>
                <div>• Body: 3-4 sentences max</div>
                <div>• CTA: "Open to learning more?"</div>
                <div>• Total: Under 80 words</div>
                <div>• Pain points: Money/Time focused</div>
              </div>
            </div>

            {/* Form Card */}
            <div style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              borderRadius: 16, 
              padding: 32
            }}>
              <CEHForm onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ 
        borderTop: '1px solid var(--border-subtle)', 
        padding: '20px 24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 13
      }}>
        <Link href="/" style={{ color: 'var(--brand)', textDecoration: 'none' }}>← Back to ColdlyBound</Link>
        <span style={{ margin: '0 12px' }}>·</span>
        CEH Cold Email Hub
      </footer>
    </div>
  );
}
