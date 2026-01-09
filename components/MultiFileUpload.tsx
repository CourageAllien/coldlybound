'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, AlertCircle, Plus } from 'lucide-react';

interface MultiFileUploadProps {
  onFilesSelect: (files: File[]) => void;
  files: File[];
  maxFiles?: number;
  error?: string;
}

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.rtf';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function MultiFileUpload({ 
  onFilesSelect, 
  files, 
  maxFiles = 3,
  error 
}: MultiFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: File[] = [];
    
    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }
      if (files.length + validFiles.length >= maxFiles) {
        alert(`Maximum ${maxFiles} files allowed.`);
        break;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      onFilesSelect([...files, ...validFiles]);
    }
  }, [files, maxFiles, onFilesSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      addFiles(selectedFiles);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      addFiles(droppedFiles);
    }
  }, [addFiles]);

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

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesSelect(newFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canAddMore = files.length < maxFiles;

  return (
    <div>
      {/* File List */}
      {files.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  background: 'rgba(245, 158, 11, 0.15)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#f59e0b'
                }}>
                  <FileText size={18} />
                </div>
                <div>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--bg-hover)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {canAddMore && (
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
            gap: 10,
            padding: files.length > 0 ? 20 : 32,
            background: isDragging ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-base)',
            border: `2px dashed ${error ? 'var(--error)' : isDragging ? '#f59e0b' : 'var(--border-subtle)'}`,
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
            multiple
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
          
          {files.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
              <Plus size={18} color="#f59e0b" />
              <p style={{ fontWeight: 500, color: '#f59e0b', fontSize: 14 }}>
                Add another file ({files.length}/{maxFiles})
              </p>
            </div>
          ) : (
            <>
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
                  PDF, DOC, DOCX, PPT, TXT (max {maxFiles} files, 10MB each)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* File Count Indicator */}
      {files.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          {files.length} of {maxFiles} files attached
        </p>
      )}
      
      {error && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6, 
          fontSize: 12, 
          color: 'var(--error)',
          marginTop: 8,
        }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}
