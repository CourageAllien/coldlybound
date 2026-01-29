'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Download, RefreshCw, AlertTriangle, FileDown } from 'lucide-react';
import { BulkJobSummary } from '@/lib/types';

interface BulkProgressProps {
  jobId: string;
  onComplete: () => void;
  onNewJob: () => void;
}

export default function BulkProgress({ jobId, onComplete, onNewJob }: BulkProgressProps) {
  const [job, setJob] = useState<BulkJobSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    const fetchStatus = async () => {
      if (!isMounted) return;
      
      try {
        const response = await fetch(`/api/bulk/status?jobId=${jobId}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch job status');
        }
        
        if (!isMounted) return;
        
        setJob(data.job);
        
        // Stop polling when job is complete or failed
        if (data.job.status === 'completed' || data.job.status === 'failed' || data.job.status === 'cancelled') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (data.job.status === 'completed') {
            onComplete();
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch status');
        }
      }
    };
    
    // Initial fetch
    fetchStatus();
    
    // Poll every 2 seconds only if job might still be processing
    intervalId = setInterval(fetchStatus, 2000);
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, onComplete]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/bulk/download?jobId=${jobId}`);
      
      if (!response.ok) {
        throw new Error('Failed to download');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coldlybound-bulk-${jobId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  if (error) {
    return (
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
          <XCircle size={28} color="var(--error)" />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Error</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{error}</p>
        <button onClick={onNewJob} className="btn-secondary">
          <RefreshCw size={16} />
          Start New Job
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ 
        background: 'var(--bg-elevated)', 
        border: '1px solid var(--border-subtle)',
        borderRadius: 16, 
        padding: 48,
        textAlign: 'center'
      }}>
        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--brand)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading job status...</p>
      </div>
    );
  }

  const progress = job.totalProspects > 0 
    ? Math.round((job.processedCount / job.totalProspects) * 100) 
    : 0;

  const isComplete = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isProcessing = job.status === 'processing' || job.status === 'pending';

  return (
    <div style={{ 
      background: 'var(--bg-elevated)', 
      border: '1px solid var(--border-subtle)',
      borderRadius: 16, 
      padding: 32
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        {isComplete ? (
          <>
            <div style={{ 
              width: 64, 
              height: 64, 
              borderRadius: 16, 
              background: 'rgba(0, 212, 170, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle size={32} color="var(--accent)" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Generation Complete!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {job.successCount * 3} emails generated for {job.successCount} prospects
            </p>
          </>
        ) : isFailed ? (
          <>
            <div style={{ 
              width: 64, 
              height: 64, 
              borderRadius: 16, 
              background: 'rgba(255, 90, 90, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <XCircle size={32} color="var(--error)" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Generation Failed</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Something went wrong during processing
            </p>
          </>
        ) : (
          <>
            <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--brand)' }} />
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Generating Emails...</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Processing {job.totalProspects} prospects × 3 emails each
            </p>
          </>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Progress</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{ 
          height: 8, 
          background: 'var(--bg-base)', 
          borderRadius: 4, 
          overflow: 'hidden' 
        }}>
          <div style={{ 
            height: '100%', 
            width: `${progress}%`, 
            background: isComplete 
              ? 'var(--accent)' 
              : isFailed 
                ? 'var(--error)' 
                : 'linear-gradient(90deg, var(--brand), var(--brand-light))',
            borderRadius: 4,
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 16, 
        marginBottom: 24 
      }}>
        <div style={{ 
          background: 'var(--bg-base)', 
          borderRadius: 12, 
          padding: 16, 
          textAlign: 'center' 
        }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {job.processedCount}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Processed</p>
        </div>
        <div style={{ 
          background: 'var(--bg-base)', 
          borderRadius: 12, 
          padding: 16, 
          textAlign: 'center' 
        }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
            {job.successCount}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Successful</p>
        </div>
        <div style={{ 
          background: 'var(--bg-base)', 
          borderRadius: 12, 
          padding: 16, 
          textAlign: 'center' 
        }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: job.failedCount > 0 ? 'var(--error)' : 'var(--text-primary)' }}>
            {job.failedCount}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Failed</p>
        </div>
      </div>

      {/* Estimated Time */}
      {isProcessing && job.processedCount > 0 && (
        <div style={{ 
          background: 'var(--bg-base)', 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertTriangle size={18} color="var(--warning)" />
          <div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Estimated time remaining: ~{estimateTimeRemaining(job.processedCount, job.totalProspects)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              You can leave this page. Progress will continue in the background.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        {isComplete && (
          <button 
            onClick={handleDownload} 
            className="btn-primary" 
            style={{ flex: 1 }}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <FileDown size={18} />
                Download CSV
              </>
            )}
          </button>
        )}
        
        <button onClick={onNewJob} className="btn-secondary" style={{ flex: isComplete ? 0 : 1 }}>
          <RefreshCw size={16} />
          {isComplete ? 'New Job' : 'Cancel & Start New'}
        </button>
      </div>
    </div>
  );
}

function estimateTimeRemaining(processed: number, total: number): string {
  // Assume ~3 seconds per prospect (website scrape + Claude call)
  const remaining = total - processed;
  const secondsPerProspect = 3;
  const totalSeconds = remaining * secondsPerProspect;
  
  if (totalSeconds < 60) {
    return 'less than a minute';
  } else if (totalSeconds < 3600) {
    const minutes = Math.ceil(totalSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.ceil((totalSeconds % 3600) / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}
