'use client';

import { useState } from 'react';
import EmailForm from '@/components/EmailForm';
import EmailOutput from '@/components/EmailOutput';
import LoadingState from '@/components/LoadingState';
import { AlertCircle, Sparkles, RefreshCw } from 'lucide-react';

interface Email {
  subject: string;
  body: string;
}

interface GeneratedResult {
  emails: Email[];
  style: string;
  targetCompany: string;
  transformedWhatWeDo?: string;
  originalWhatWeDo?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [lastFormData, setLastFormData] = useState<FormData | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    setLastFormData(formData);

    try {
      const response = await fetch('/api/generate', {
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
        transformedWhatWeDo: result.transformedWhatWeDo,
        originalWhatWeDo: result.originalWhatWeDo,
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
              background: 'linear-gradient(135deg, var(--brand), #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 91, 255, 0.3)'
            }}>
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>ColdlyBound</span>
            </div>
          </div>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px', 
            borderRadius: 24, 
            background: 'var(--accent-muted)', 
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 500
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}></span>
            29 Styles Available
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>
        
        {/* Show form or results */}
        {generatedResult && generatedResult.emails.length > 0 ? (
          <div className="animate-fade-up">
            <EmailOutput
              emails={generatedResult.emails}
              style={generatedResult.style}
              targetCompany={generatedResult.targetCompany}
              onRegenerate={handleRegenerate}
              onNewEmail={handleReset}
              isRegenerating={isLoading}
              transformedWhatWeDo={generatedResult.transformedWhatWeDo}
              originalWhatWeDo={generatedResult.originalWhatWeDo}
            />
          </div>
        ) : isLoading ? (
          <LoadingState />
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
                <span style={{ color: 'var(--brand)' }}>Cold emails</span>
                <span style={{ color: 'var(--text-primary)' }}> that convert</span>
              </h1>
              <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
                Generate 5 hyper-personalized emails under 100 words using 29 proven frameworks from top sales experts.
              </p>
            </div>

            {/* Form Card */}
            <div style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              borderRadius: 16, 
              padding: 32
            }}>
              <EmailForm onSubmit={handleSubmit} isLoading={isLoading} />
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
        © 2024 ColdlyBound · Built with Claude AI
      </footer>
    </div>
  );
}
