'use client';

import { useState, useRef } from 'react';
import { AlertCircle, Loader2, Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle } from 'lucide-react';
import StyleSelector from './StyleSelector';
import FileUpload from './FileUpload';
import { validateAndParseCSV, CSVValidationResult } from '@/lib/csv-parser';

interface BulkUploadFormProps {
  onSubmit: (data: {
    prospects: CSVValidationResult['prospects'];
    senderUrl: string;
    whatWeDo: string;
    intent: string;
    styleSlug: string;
    attachedFile?: File;
  }) => void;
  isLoading: boolean;
}

export default function BulkUploadForm({ onSubmit, isLoading }: BulkUploadFormProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvValidation, setCsvValidation] = useState<CSVValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  const [senderUrl, setSenderUrl] = useState('');
  const [styleSlug, setStyleSlug] = useState<string | null>(null);
  const [whatWeDo, setWhatWeDo] = useState('');
  const [intent, setIntent] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCSVSelect = async (file: File) => {
    setCsvFile(file);
    setIsValidating(true);
    setCsvValidation(null);
    
    try {
      const content = await file.text();
      const validation = validateAndParseCSV(content);
      setCsvValidation(validation);
      
      if (validation.isValid) {
        setErrors(prev => ({ ...prev, csv: '' }));
      } else {
        setErrors(prev => ({ ...prev, csv: validation.errors.join('. ') }));
      }
    } catch {
      setErrors(prev => ({ ...prev, csv: 'Failed to read CSV file' }));
    } finally {
      setIsValidating(false);
    }
  };

  const handleCSVDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      handleCSVSelect(file);
    } else {
      setErrors(prev => ({ ...prev, csv: 'Please upload a CSV file' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    
    if (!csvFile || !csvValidation?.isValid) {
      newErrors.csv = 'Please upload a valid CSV file';
    }
    if (!senderUrl.trim()) newErrors.senderUrl = 'Required';
    if (!styleSlug) newErrors.style = 'Required';
    if (!whatWeDo.trim()) newErrors.whatWeDo = 'Required';
    if (!intent.trim()) newErrors.intent = 'Required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    
    onSubmit({
      prospects: csvValidation!.prospects,
      senderUrl: senderUrl.trim(),
      whatWeDo: whatWeDo.trim(),
      intent: intent.trim(),
      styleSlug: styleSlug!,
      attachedFile: attachedFile || undefined,
    });
  };

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500 as const,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  };

  const errorStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--error)',
    marginTop: 6,
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* CSV Upload Section */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>
          Upload Prospect List (CSV) <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        
        <div
          onDrop={handleCSVDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${errors.csv ? 'var(--error)' : csvValidation?.isValid ? 'var(--accent)' : 'var(--border-subtle)'}`,
            borderRadius: 12,
            padding: 32,
            textAlign: 'center',
            cursor: 'pointer',
            background: csvValidation?.isValid ? 'rgba(0, 212, 170, 0.05)' : 'var(--bg-base)',
            transition: 'all 0.2s ease',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleCSVSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />
          
          {isValidating ? (
            <div style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p>Validating CSV...</p>
            </div>
          ) : csvFile && csvValidation ? (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 12, 
                marginBottom: 12 
              }}>
                {csvValidation.isValid ? (
                  <CheckCircle size={24} color="var(--accent)" />
                ) : (
                  <AlertCircle size={24} color="var(--error)" />
                )}
                <FileSpreadsheet size={24} color="var(--text-muted)" />
                <span style={{ fontWeight: 500 }}>{csvFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCsvFile(null);
                    setCsvValidation(null);
                  }}
                  style={{
                    background: 'var(--bg-surface)',
                    border: 'none',
                    borderRadius: 6,
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  <X size={16} color="var(--text-muted)" />
                </button>
              </div>
              
              {csvValidation.isValid && (
                <div style={{ 
                  display: 'flex', 
                  gap: 16, 
                  justifyContent: 'center',
                  fontSize: 14,
                  color: 'var(--text-secondary)'
                }}>
                  <span><strong>{csvValidation.rowCount}</strong> prospects</span>
                  <span><strong>3</strong> emails each</span>
                  <span><strong>{csvValidation.rowCount * 3}</strong> total emails</span>
                </div>
              )}
              
              {csvValidation.warnings.length > 0 && (
                <div style={{ 
                  marginTop: 12, 
                  padding: 12, 
                  background: 'rgba(255, 178, 36, 0.1)', 
                  borderRadius: 8,
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--warning)' }}>
                    <AlertTriangle size={14} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Warnings</span>
                  </div>
                  <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                    {csvValidation.warnings.slice(0, 5).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>
              <Upload size={32} style={{ margin: '0 auto 12px' }} />
              <p style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--brand)', fontWeight: 500 }}>Click to upload</span> or drag and drop
              </p>
              <p style={{ fontSize: 13 }}>CSV file with up to 5,000 prospects</p>
            </div>
          )}
        </div>
        
        {errors.csv && <div style={errorStyle}><AlertCircle size={12} /> {errors.csv}</div>}
        
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Required columns: First Name, Last Name, Email, Job Title, Company Name, Website
        </p>
      </div>

      {/* Sender Info */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>
          Your Website <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        <input
          type="text"
          value={senderUrl}
          onChange={(e) => { setSenderUrl(e.target.value); setErrors(p => ({...p, senderUrl: ''})); }}
          placeholder="yourcompany.com"
          style={errors.senderUrl ? { borderColor: 'var(--error)' } : {}}
        />
        {errors.senderUrl && <div style={errorStyle}><AlertCircle size={12} /> {errors.senderUrl}</div>}
      </div>

      {/* Email Style */}
      <div style={{ marginBottom: 20 }}>
        <StyleSelector
          selectedStyle={styleSlug}
          onStyleSelect={(slug) => { setStyleSlug(slug); setErrors(p => ({...p, style: ''})); }}
          error={errors.style}
        />
      </div>

      {/* What Do We Do */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>
          What Do We Do? <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        <textarea
          value={whatWeDo}
          onChange={(e) => { setWhatWeDo(e.target.value); setErrors(p => ({...p, whatWeDo: ''})); }}
          placeholder="e.g., We do SEO, We run paid ads, We do lead generation..."
          rows={2}
          style={{ 
            resize: 'none',
            ...(errors.whatWeDo ? { borderColor: 'var(--error)' } : {})
          }}
        />
        {errors.whatWeDo && <div style={errorStyle}><AlertCircle size={12} /> {errors.whatWeDo}</div>}
      </div>

      {/* Intent */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>
          What are you pitching? <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        <textarea
          value={intent}
          onChange={(e) => { setIntent(e.target.value); setErrors(p => ({...p, intent: ''})); }}
          placeholder="e.g., I want to pitch our AI-powered lead generation service to help them book more meetings"
          rows={2}
          style={{ 
            resize: 'none',
            ...(errors.intent ? { borderColor: 'var(--error)' } : {})
          }}
        />
        {errors.intent && <div style={errorStyle}><AlertCircle size={12} /> {errors.intent}</div>}
      </div>

      {/* Optional: Additional File */}
      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>
          Additional Info <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
        </label>
        
        <FileUpload 
          file={attachedFile}
          onFileSelect={setAttachedFile}
        />
        
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Upload case studies, pitch decks, or other context to improve personalization
        </p>
      </div>

      {/* Submit */}
      <button 
        type="submit" 
        className="btn-primary" 
        style={{ width: '100%' }} 
        disabled={isLoading || isValidating || !csvValidation?.isValid}
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Starting Bulk Generation...
          </>
        ) : (
          <>
            <Upload size={18} />
            Generate {csvValidation?.rowCount ? `${csvValidation.rowCount * 3} Emails` : 'Emails'}
          </>
        )}
      </button>
      
      {csvValidation?.isValid && csvValidation.rowCount > 100 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
          Large batches may take several minutes to process. You can leave this page and return later.
        </p>
      )}
    </form>
  );
}
