'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  error?: string;
}

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.rtf,.csv';

export default function FileUpload({ onFileSelect, file, error }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File too large. Maximum size is 10MB.');
        return;
      }
      onFileSelect(selectedFile);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.size > 10 * 1024 * 1024) {
        alert('File too large. Maximum size is 10MB.');
        return;
      }
      onFileSelect(droppedFile);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const removeFile = () => {
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (file) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 10, 
            background: 'var(--brand-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--brand)'
          }}>
            <FileText size={20} />
          </div>
          <div>
            <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 14 }}>
              {file.name}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={removeFile}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: 'var(--bg-hover)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        background: isDragging ? 'var(--brand-muted)' : 'var(--bg-base)',
        border: `2px dashed ${error ? 'var(--error)' : isDragging ? 'var(--brand)' : 'var(--border-subtle)'}`,
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        overflow: 'hidden',
      }}
    >
      {/* Invisible file input covering the entire area */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleFileChange}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          zIndex: 10,
        }}
      />
      
      <div style={{ 
        width: 48, 
        height: 48, 
        borderRadius: 12, 
        background: 'var(--bg-surface)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <Upload size={22} color="var(--text-muted)" />
      </div>
      <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
        <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
          Click to upload or drag and drop
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          PDF, DOC, DOCX, PPT, TXT, CSV (max 10MB)
        </p>
      </div>
      
      {error && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6, 
          fontSize: 12, 
          color: 'var(--error)',
          pointerEvents: 'none',
        }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}
