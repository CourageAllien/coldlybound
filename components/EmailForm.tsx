'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import StyleSelector from './StyleSelector';
import FileUpload from './FileUpload';

interface EmailFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
}

export default function EmailForm({ onSubmit, isLoading }: EmailFormProps) {
  const [targetFirstName, setTargetFirstName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [targetLinkedInUrl, setTargetLinkedInUrl] = useState('');
  const [senderUrl, setSenderUrl] = useState('');
  const [styleSlug, setStyleSlug] = useState<string | null>(null);
  const [whatWeDo, setWhatWeDo] = useState('');
  const [intent, setIntent] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!targetFirstName.trim()) newErrors.targetFirstName = 'Required';
    if (!targetUrl.trim()) newErrors.targetUrl = 'Required';
    if (!senderUrl.trim()) newErrors.senderUrl = 'Required';
    if (!styleSlug) newErrors.style = 'Required';
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
    formData.append('styleSlug', styleSlug!);
    formData.append('intent', intent.trim());
    formData.append('attachedFile', attachedFile!);
    if (targetLinkedInUrl.trim()) {
      formData.append('targetLinkedInUrl', targetLinkedInUrl.trim());
    }
    if (whatWeDo.trim()) {
      formData.append('whatWeDo', whatWeDo.trim());
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
          What Do We Do? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional - we&apos;ll enhance it)</span>
        </label>
        <textarea
          value={whatWeDo}
          onChange={(e) => setWhatWeDo(e.target.value)}
          placeholder="e.g., We do SEO, We run paid ads, We do lead generation..."
          rows={2}
          style={{ resize: 'none' }}
        />
        <div style={{ 
          fontSize: 12, 
          color: 'var(--text-muted)', 
          marginTop: 8,
          padding: '10px 12px',
          background: 'var(--bg-base)',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: 'var(--brand)', fontWeight: 500 }}>✨ AI Transform:</span> Type what you ARE and we convert it to what you DO
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>&quot;We do SEO&quot;</span>
            <span style={{ color: 'var(--brand)' }}>→</span>
            <span style={{ color: 'var(--accent)' }}>&quot;We get B2B companies ranking on page 1 in 90 days&quot;</span>
          </div>
        </div>
      </div>

      {/* Intent */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>
          What are you pitching? <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        <textarea
          value={intent}
          onChange={(e) => { setIntent(e.target.value); setErrors(p => ({...p, intent: ''})); }}
          placeholder="e.g., I want to pitch our poker-based leadership training for their executive team"
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
      <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating 5 Emails...
          </>
        ) : (
          <>
            <Sparkles size={18} />
            Generate 5 Cold Emails
          </>
        )}
      </button>
    </form>
  );
}
