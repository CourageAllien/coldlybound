'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, XCircle, RefreshCw, Clock, FileDown } from 'lucide-react';

interface BulkProgressProps {
  jobId: string;
  initialTotal: number;
  onComplete: () => void;
  onNewJob: () => void;
}

// Estimate ~4 seconds per prospect
const SECONDS_PER_PROSPECT = 4;

export default function BulkProgress({ jobId, initialTotal, onComplete, onNewJob }: BulkProgressProps) {
  const [processedCount, setProcessedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalProspects, setTotalProspects] = useState(initialTotal);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const mountedRef = useRef(true);
  const isProcessingRef = useRef(false);

  // Process chunks until complete
  useEffect(() => {
    mountedRef.current = true;
    
    const processNextChunk = async () => {
      // Prevent overlapping calls
      if (isProcessingRef.current || !mountedRef.current) return;
      isProcessingRef.current = true;
      
      try {
        console.log('Triggering process chunk...');
        
        const response = await fetch('/api/bulk/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        });
        
        if (!mountedRef.current) return;
        
        const data = await response.json();
        console.log('Process response:', data);
        
        if (!response.ok) {
          throw new Error(data.error || 'Processing failed');
        }
        
        // Update counts
        setProcessedCount(data.processedCount || 0);
        setSuccessCount(data.successCount || 0);
        setFailedCount(data.failedCount || 0);
        if (data.totalProspects) {
          setTotalProspects(data.totalProspects);
        }
        
        // Check if complete
        if (data.isComplete || data.status === 'completed') {
          console.log('Processing complete!');
          setIsComplete(true);
          onComplete();
        } else {
          // Continue processing - schedule next chunk
          console.log(`Processed chunk. Remaining: ${data.remainingCount}. Scheduling next...`);
          isProcessingRef.current = false;
          
          // Small delay then process next chunk
          setTimeout(() => {
            if (mountedRef.current) {
              processNextChunk();
            }
          }, 200);
        }
        
      } catch (err) {
        console.error('Processing error:', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Processing failed');
        }
      } finally {
        isProcessingRef.current = false;
      }
    };
    
    // Start processing
    processNextChunk();
    
    return () => {
      mountedRef.current = false;
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

  const progress = totalProspects > 0 
    ? Math.round((processedCount / totalProspects) * 100) 
    : 0;

  const totalEmails = successCount * 3;
  const remainingProspects = totalProspects - processedCount;
  const estimatedSecondsRemaining = remainingProspects * SECONDS_PER_PROSPECT;

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
              {totalEmails} emails generated for {successCount} prospects
            </p>
          </>
        ) : (
          <>
            <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--brand)' }} />
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Generating Emails...</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Processing {totalProspects} prospects × 3 emails each = {totalProspects * 3} emails
            </p>
          </>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {processedCount} of {totalProspects} prospects
          </span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{ 
          height: 12, 
          background: 'var(--bg-base)', 
          borderRadius: 6, 
          overflow: 'hidden' 
        }}>
          <div style={{ 
            height: '100%', 
            width: `${progress}%`, 
            background: isComplete 
              ? 'var(--accent)' 
              : 'linear-gradient(90deg, var(--brand), var(--brand-light))',
            borderRadius: 6,
            transition: 'width 0.3s ease'
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
            {processedCount}
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
            {successCount}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Successful</p>
        </div>
        <div style={{ 
          background: 'var(--bg-base)', 
          borderRadius: 12, 
          padding: 16, 
          textAlign: 'center' 
        }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: failedCount > 0 ? 'var(--error)' : 'var(--text-primary)' }}>
            {failedCount}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Failed</p>
        </div>
      </div>

      {/* Estimated Time - only show when not complete */}
      {!isComplete && remainingProspects > 0 && (
        <div style={{ 
          background: 'var(--bg-base)', 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <Clock size={18} color="var(--brand)" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <strong>~{formatTimeRemaining(estimatedSecondsRemaining)}</strong> remaining
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {remainingProspects} prospects left • Processing in batches of 10
            </p>
          </div>
          <Loader2 size={16} className="animate-spin" color="var(--brand)" />
        </div>
      )}

      {/* Actions - Download only visible when complete */}
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
                Download CSV ({totalEmails} emails)
              </>
            )}
          </button>
        )}
        
        <button onClick={onNewJob} className="btn-secondary" style={{ flex: isComplete ? 0 : 1 }}>
          <RefreshCw size={16} />
          {isComplete ? 'New Job' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return 'less than a minute';
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}
