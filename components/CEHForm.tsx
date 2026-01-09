'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import FileUpload from './FileUpload';

interface CEHFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
}

interface StyleOption {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export default function CEHForm({ onSubmit, isLoading }: CEHFormProps) {
  const [targetFirstName, setTargetFirstName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [targetLinkedInUrl, setTargetLinkedInUrl] = useState('');
  const [senderUrl, setSenderUrl] = useState('');
  const [styleSlug, setStyleSlug] = useState<string>('email-temp');
  const [intent, setIntent] = useState('');
  const [painPoint, setPainPoint] = useState<string>('make-money');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [hasTemplates, setHasTemplates] = useState(false);

  useEffect(() => {
    // Fetch regular styles
    fetch('/api/styles')
      .then(res => res.json())
      .then(data => setStyles(data))
      .catch(console.error);
    
    // Check if templates exist
    fetch('/api/ceh-templates')
      .then(res => res.json())
      .then(data => setHasTemplates(data.templates && data.templates.length > 0))
      .catch(() => setHasTemplates(false));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!targetFirstName.trim()) newErrors.targetFirstName = 'Required';
    if (!targetUrl.trim()) newErrors.targetUrl = 'Required';
    if (!senderUrl.trim()) newErrors.senderUrl = 'Required';
    if (!intent.trim()) newErrors.intent = 'Required';
    if (!attachedFile) newErrors.file = 'Please attach a file';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    
    const formData = new FormData();
    formData.append('targetFirstName', targetFirstName.trim());
    formData.append('targetUrl', targetUrl.trim());
    formData.append('senderUrl', senderUrl.trim());
    formData.append('styleSlug', styleSlug);
    formData.append('intent', intent.trim());
    formData.append('painPoint', painPoint);
    formData.append('attachedFile', attachedFile!);
    if (targetLinkedInUrl.trim()) {
      formData.append('targetLinkedInUrl', targetLinkedInUrl.trim());
    }
    
    onSubmit(formData);
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
      {/* Row 1: Name + Company URL */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>
            Target First Name <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <input
            type="text"
            value={targetFirstName}
            onChange={(e) => { setTargetFirstName(e.target.value); setErrors(p => ({...p, targetFirstName: ''})); }}
            placeholder="Jennifer"
            style={errors.targetFirstName ? { borderColor: 'var(--error)' } : {}}
          />
          {errors.targetFirstName && <div style={errorStyle}><AlertCircle size={12} /> {errors.targetFirstName}</div>}
        </div>
        <div>
          <label style={labelStyle}>
            Target Company Website <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => { setTargetUrl(e.target.value); setErrors(p => ({...p, targetUrl: ''})); }}
            placeholder="techflow.com"
            style={errors.targetUrl ? { borderColor: 'var(--error)' } : {}}
          />
          {errors.targetUrl && <div style={errorStyle}><AlertCircle size={12} /> {errors.targetUrl}</div>}
        </div>
      </div>

      {/* Row 2: LinkedIn + Your URL */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>
            Target LinkedIn <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={targetLinkedInUrl}
            onChange={(e) => setTargetLinkedInUrl(e.target.value)}
            placeholder="linkedin.com/in/jennifer"
          />
        </div>
        <div>
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
      </div>

      {/* Pain Point Selection */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>
          Primary Pain Point <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { value: 'make-money', label: '💰 Make Money' },
            { value: 'save-money', label: '💵 Save Money' },
            { value: 'save-time', label: '⏱️ Save Time' },
          ].map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPainPoint(option.value)}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: painPoint === option.value ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
                background: painPoint === option.value ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-base)',
                color: painPoint === option.value ? '#f59e0b' : 'var(--text-secondary)',
                fontWeight: 500,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Email Style */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>
          Email Style <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        <select
          value={styleSlug}
          onChange={(e) => setStyleSlug(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          <option value="email-temp" style={{ background: 'var(--bg-elevated)' }}>
            ✨ Email Temp {hasTemplates ? '(Templates Available)' : '(Add templates in admin)'}
          </option>
          <optgroup label="Standard Styles">
            {styles.map(style => (
              <option key={style.id} value={style.slug} style={{ background: 'var(--bg-elevated)' }}>
                {style.name}
              </option>
            ))}
          </optgroup>
        </select>
        {styleSlug === 'email-temp' && !hasTemplates && (
          <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 6 }}>
            Add template emails in the Templates page for best results with Email Temp style.
          </p>
        )}
      </div>

      {/* Intent */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>
          What are you pitching? <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        <textarea
          value={intent}
          onChange={(e) => { setIntent(e.target.value); setErrors(p => ({...p, intent: ''})); }}
          placeholder="e.g., We help B2B companies get 40% more qualified leads without increasing ad spend"
          rows={2}
          style={{ 
            resize: 'none',
            ...(errors.intent ? { borderColor: 'var(--error)' } : {})
          }}
        />
        {errors.intent && <div style={errorStyle}><AlertCircle size={12} /> {errors.intent}</div>}
      </div>

      {/* File Upload */}
      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>
          Attach Target Info <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        
        <FileUpload 
          file={attachedFile}
          onFileSelect={(file) => {
            setAttachedFile(file);
            if (file) setErrors(p => ({...p, file: ''}));
          }}
          error={errors.file}
        />
        
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Upload LinkedIn exports, company research, role descriptions, or any relevant target info
        </p>
      </div>

      {/* Submit */}
      <button 
        type="submit" 
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
          opacity: isLoading ? 0.7 : 1,
        }} 
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating 8 Emails...
          </>
        ) : (
          <>
            <Sparkles size={18} />
            Generate 8 CEH Emails
          </>
        )}
      </button>
    </form>
  );
}
