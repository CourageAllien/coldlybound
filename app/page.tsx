'use client';

import { useState } from 'react';
import EmailForm from '@/components/EmailForm';
import EmailOutput from '@/components/EmailOutput';
import LoadingState from '@/components/LoadingState';
import BulkUploadForm from '@/components/BulkUploadForm';
import BulkProgress from '@/components/BulkProgress';
import { AlertCircle, Sparkles, RefreshCw, User, Users } from 'lucide-react';
import { CSVValidationResult } from '@/lib/csv-parser';

type Mode = 'single' | 'bulk';
type BulkState = 'form' | 'processing' | 'complete';

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
  // Mode state
  const [mode, setMode] = useState<Mode>('single');
  
  // Single mode state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [lastFormData, setLastFormData] = useState<FormData | null>(null);
  
  // Bulk mode state
  const [bulkState, setBulkState] = useState<BulkState>('form');
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkTotalProspects, setBulkTotalProspects] = useState(0);
  const [bulkIsLoading, setBulkIsLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Single mode handlers
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
  
  // Bulk mode handlers
  const handleBulkSubmit = async (data: {
    prospects: CSVValidationResult['prospects'];
    senderUrl: string;
    whatWeDo: string;
    intent: string;
    styleSlug: string;
    attachedFile?: File;
  }) => {
    setBulkIsLoading(true);
    setBulkError(null);
    setBulkState('form'); // Reset state
    
    try {
      const formData = new FormData();
      formData.append('prospects', JSON.stringify(data.prospects));
      formData.append('senderUrl', data.senderUrl);
      formData.append('whatWeDo', data.whatWeDo);
      formData.append('intent', data.intent);
      formData.append('styleSlug', data.styleSlug);
      if (data.attachedFile) {
        formData.append('attachedFile', data.attachedFile);
      }
      
      const response = await fetch('/api/bulk/start', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to start bulk job');
      }
      
      setBulkJobId(result.jobId);
      setBulkTotalProspects(data.prospects.length);
      
      // Job is always pending initially, processing happens in chunks
      setBulkState('processing');
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to start bulk job');
    } finally {
      setBulkIsLoading(false);
    }
  };
  
  const handleBulkComplete = () => {
    setBulkState('complete');
  };
  
  const handleBulkReset = () => {
    setBulkState('form');
    setBulkJobId(null);
    setBulkTotalProspects(0);
    setBulkError(null);
  };
  
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    // Reset state when switching modes
    if (newMode === 'single') {
      handleBulkReset();
    } else {
      handleReset();
    }
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
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, marginBottom: 12, lineHeight: 1.2 }}>
            <span style={{ color: 'var(--brand)' }}>Cold emails</span>
            <span style={{ color: 'var(--text-primary)' }}> that convert</span>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
            Generate hyper-personalized emails using 29 proven frameworks from top sales experts.
          </p>
        </div>
        
        {/* Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: 32,
          gap: 8
        }}>
          <button
            onClick={() => handleModeChange('single')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: mode === 'single' ? 'var(--brand)' : 'var(--bg-elevated)',
              color: mode === 'single' ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${mode === 'single' ? 'var(--brand)' : 'var(--border-subtle)'}`,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <User size={16} />
            Single Prospect
          </button>
          <button
            onClick={() => handleModeChange('bulk')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: mode === 'bulk' ? 'var(--brand)' : 'var(--bg-elevated)',
              color: mode === 'bulk' ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${mode === 'bulk' ? 'var(--brand)' : 'var(--border-subtle)'}`,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Users size={16} />
            Bulk Upload (up to 1K)
          </button>
        </div>

        {/* Single Mode Content */}
        {mode === 'single' && (
          <>
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
                <div style={{ 
                  background: 'var(--bg-elevated)', 
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 16, 
                  padding: 32
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    marginBottom: 24,
                    color: 'var(--text-muted)',
                    fontSize: 14
                  }}>
                    <User size={16} />
                    Generate 5 personalized emails for a single prospect
                  </div>
                  <EmailForm onSubmit={handleSubmit} isLoading={isLoading} />
                </div>
              </div>
            )}
          </>
        )}

        {/* Bulk Mode Content */}
        {mode === 'bulk' && (
          <div className="animate-fade-up">
            {bulkIsLoading ? (
              /* Loading state while generating */
              <div style={{ 
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
                  background: 'var(--brand-muted)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <div className="animate-spin">
                    <Sparkles size={28} color="var(--brand)" />
                  </div>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Generating Emails...</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                  Researching prospects and crafting personalized emails.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  This may take 20-30 seconds per prospect.
                </p>
              </div>
            ) : (bulkState === 'complete' || bulkState === 'processing') && bulkJobId ? (
              <BulkProgress 
                jobId={bulkJobId}
                initialTotal={bulkTotalProspects}
                onComplete={handleBulkComplete}
                onNewJob={handleBulkReset}
              />
            ) : bulkError ? (
              <div style={{ 
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
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Failed to Start Job</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{bulkError}</p>
                <button onClick={handleBulkReset} className="btn-secondary">
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </div>
            ) : (
              <div style={{ 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: 16, 
                padding: 32
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  marginBottom: 24,
                  color: 'var(--text-muted)',
                  fontSize: 14
                }}>
                  <Users size={16} />
                  Upload a CSV with up to 1,000 prospects · 3 emails per prospect
                </div>
                <BulkUploadForm onSubmit={handleBulkSubmit} isLoading={bulkIsLoading} />
              </div>
            )}
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
