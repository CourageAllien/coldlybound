'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, ArrowLeft, FileText, Upload, Copy } from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  subject?: string;
  body: string;
  created_at: string;
}

export default function CEHAdminPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; subject: string; body: string }>({ name: '', subject: '', body: '' });
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', body: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedEmails, setParsedEmails] = useState<{ name: string; subject: string; body: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/ceh-templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      showMessage('error', 'Failed to load templates. Check Supabase connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const addTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.body.trim()) {
      showMessage('error', 'Name and body are required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/ceh-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add',
          template: {
            name: newTemplate.name.trim(),
            subject: newTemplate.subject.trim() || undefined,
            body: newTemplate.body.trim(),
          }
        }),
      });
      
      if (res.ok) {
        await fetchTemplates();
        setNewTemplate({ name: '', subject: '', body: '' });
        setShowAddForm(false);
        showMessage('success', 'Template added successfully!');
      } else {
        throw new Error('Failed to add');
      }
    } catch (error) {
      showMessage('error', 'Failed to add template');
    } finally {
      setIsSaving(false);
    }
  };

  const addBulkTemplates = async () => {
    if (parsedEmails.length === 0) {
      showMessage('error', 'No emails parsed from file');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/ceh-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'bulk-add',
          templates: parsedEmails.map(e => ({
            name: e.name,
            subject: e.subject || undefined,
            body: e.body,
          }))
        }),
      });
      
      if (res.ok) {
        await fetchTemplates();
        setParsedEmails([]);
        setBulkFile(null);
        setShowAddForm(false);
        showMessage('success', `${parsedEmails.length} templates added successfully!`);
      } else {
        throw new Error('Failed to add');
      }
    } catch (error) {
      showMessage('error', 'Failed to add templates');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const res = await fetch('/api/ceh-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', template: { id } }),
      });
      
      if (res.ok) {
        await fetchTemplates();
        showMessage('success', 'Template deleted');
      }
    } catch (error) {
      showMessage('error', 'Failed to delete template');
    }
  };

  const startEditing = (template: Template) => {
    setEditingId(template.id);
    setEditData({
      name: template.name,
      subject: template.subject || '',
      body: template.body,
    });
  };

  const saveEdit = async (id: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ceh-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'update',
          template: {
            id,
            name: editData.name,
            subject: editData.subject || undefined,
            body: editData.body,
          }
        }),
      });
      
      if (res.ok) {
        await fetchTemplates();
        setEditingId(null);
        showMessage('success', 'Template updated');
      }
    } catch (error) {
      showMessage('error', 'Failed to update template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setBulkFile(file);
    
    try {
      const text = await file.text();
      const emails = parseEmailsFromText(text);
      setParsedEmails(emails);
      
      if (emails.length === 0) {
        showMessage('error', 'No emails found in file. Make sure emails are separated by "---" or blank lines.');
      } else {
        showMessage('success', `Found ${emails.length} emails in file`);
      }
    } catch (error) {
      showMessage('error', 'Failed to read file');
    }
  };

  const parseEmailsFromText = (text: string): { name: string; subject: string; body: string }[] => {
    const emails: { name: string; subject: string; body: string }[] = [];
    
    // Split by common delimiters
    const sections = text.split(/(?:^|\n)(?:---+|===+|Email\s*\d+:?|Template\s*\d+:?)(?:\n|$)/i)
      .filter(s => s.trim().length > 20);
    
    if (sections.length === 0) {
      // Try splitting by double newlines
      const altSections = text.split(/\n\s*\n\s*\n/).filter(s => s.trim().length > 20);
      sections.push(...altSections);
    }
    
    sections.forEach((section, index) => {
      const trimmed = section.trim();
      if (!trimmed) return;
      
      // Try to extract subject line
      const subjectMatch = trimmed.match(/(?:subject|subj|re):\s*(.+?)(?:\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      
      // Body is everything else
      let body = trimmed;
      if (subjectMatch) {
        body = trimmed.replace(subjectMatch[0], '').trim();
      }
      
      if (body.length > 10) {
        emails.push({
          name: `Template ${index + 1}`,
          subject,
          body,
        });
      }
    });
    
    return emails;
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
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link 
              href="/ceh"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>CEH Templates</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 8 }}>Admin</span>
            </div>
          </div>
          <div style={{ 
            padding: '8px 16px', 
            borderRadius: 24, 
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 500
          }}>
            {templates.length} Template{templates.length !== 1 ? 's' : ''}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        
        {/* Message */}
        {message && (
          <div style={{ 
            padding: 16, 
            borderRadius: 12, 
            marginBottom: 24,
            background: message.type === 'success' ? 'rgba(0, 212, 170, 0.15)' : 'rgba(255, 90, 90, 0.15)',
            border: `1px solid ${message.type === 'success' ? 'rgba(0, 212, 170, 0.3)' : 'rgba(255, 90, 90, 0.3)'}`,
            color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
          }}>
            {message.text}
          </div>
        )}

        {/* Info Card */}
        <div style={{ 
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 12, 
          padding: 20,
          marginBottom: 24
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>How Templates Work</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Add template emails that the AI will use as <strong>structural inspiration</strong> when generating CEH emails. 
            The AI analyzes structure, tone, and flow — but never copies content directly.
          </p>
        </div>

        {/* Add Template Button */}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '20px',
              background: 'var(--bg-elevated)',
              border: '2px dashed var(--border-subtle)',
              borderRadius: 12,
              color: 'var(--text-secondary)',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: 24,
            }}
          >
            <Plus size={20} />
            Add Template Email
          </button>
        )}

        {/* Add Template Form */}
        {showAddForm && (
          <div style={{ 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border-subtle)',
            borderRadius: 16, 
            padding: 24,
            marginBottom: 24
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--text-primary)' }}>
              Add Templates
            </h3>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => { setUploadMode('single'); setParsedEmails([]); setBulkFile(null); }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: uploadMode === 'single' ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
                  background: uploadMode === 'single' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-base)',
                  color: uploadMode === 'single' ? '#f59e0b' : 'var(--text-secondary)',
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Copy size={16} />
                Single (Copy/Paste)
              </button>
              <button
                type="button"
                onClick={() => { setUploadMode('bulk'); setNewTemplate({ name: '', subject: '', body: '' }); }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: uploadMode === 'bulk' ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
                  background: uploadMode === 'bulk' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-base)',
                  color: uploadMode === 'bulk' ? '#f59e0b' : 'var(--text-secondary)',
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Upload size={16} />
                Bulk (Upload File)
              </button>
            </div>

            {uploadMode === 'single' ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Template Name <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Pain Point Opener"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Subject Line <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate(p => ({ ...p, subject: e.target.value }))}
                    placeholder="e.g., quick question"
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Email Body <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <textarea
                    value={newTemplate.body}
                    onChange={(e) => setNewTemplate(p => ({ ...p, body: e.target.value }))}
                    placeholder="Paste your template email here..."
                    rows={8}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={addTemplate}
                    disabled={isSaving}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '14px 20px',
                      background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 14,
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    <Save size={16} />
                    {isSaving ? 'Saving...' : 'Save Template'}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewTemplate({ name: '', subject: '', body: '' }); }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.doc,.docx,.pdf,.md"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      padding: 32,
                      background: 'var(--bg-base)',
                      border: '2px dashed var(--border-subtle)',
                      borderRadius: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <Upload size={24} color="var(--text-muted)" />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {bulkFile ? bulkFile.name : 'Click to upload file'}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        TXT, DOC, DOCX, PDF with multiple emails
                      </p>
                    </div>
                  </button>
                  
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Separate emails with "---" or blank lines. Subject lines starting with "Subject:" will be detected.
                  </p>
                </div>

                {parsedEmails.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
                      Preview ({parsedEmails.length} emails found):
                    </p>
                    <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                      {parsedEmails.map((email, i) => (
                        <div key={i} style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                          <input
                            type="text"
                            value={email.name}
                            onChange={(e) => {
                              const updated = [...parsedEmails];
                              updated[i].name = e.target.value;
                              setParsedEmails(updated);
                            }}
                            style={{ marginBottom: 8, fontSize: 13 }}
                          />
                          {email.subject && (
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Subject: {email.subject}</p>
                          )}
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                            {email.body.slice(0, 100)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={addBulkTemplates}
                    disabled={isSaving || parsedEmails.length === 0}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '14px 20px',
                      background: parsedEmails.length > 0 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'var(--bg-surface)',
                      color: parsedEmails.length > 0 ? 'white' : 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: 14,
                      border: 'none',
                      borderRadius: 10,
                      cursor: parsedEmails.length > 0 ? 'pointer' : 'not-allowed',
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    <Save size={16} />
                    {isSaving ? 'Saving...' : `Save ${parsedEmails.length} Templates`}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setParsedEmails([]); setBulkFile(null); }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Templates List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 48, 
            background: 'var(--bg-elevated)',
            borderRadius: 16,
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ 
              width: 64, 
              height: 64, 
              borderRadius: 16, 
              background: 'var(--bg-surface)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <FileText size={28} color="var(--text-muted)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
              No Templates Yet
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
              Add your first template email to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {templates.map((template, index) => (
              <div 
                key={template.id}
                style={{ 
                  background: 'var(--bg-elevated)', 
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 16, 
                  padding: 24,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: 10, 
                      background: 'rgba(245, 158, 11, 0.15)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#f59e0b',
                      fontWeight: 700,
                      fontSize: 14
                    }}>
                      {index + 1}
                    </div>
                    {editingId === template.id ? (
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData(p => ({ ...p, name: e.target.value }))}
                        style={{ fontSize: 16, fontWeight: 600, padding: '8px 12px' }}
                      />
                    ) : (
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {template.name}
                      </h3>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editingId === template.id ? (
                      <button
                        onClick={() => saveEdit(template.id)}
                        disabled={isSaving}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          background: 'var(--success)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <Save size={14} />
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => startEditing(template)}
                        style={{
                          padding: '8px 14px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      style={{
                        padding: '8px',
                        background: 'rgba(255, 90, 90, 0.1)',
                        border: '1px solid rgba(255, 90, 90, 0.3)',
                        borderRadius: 8,
                        color: 'var(--error)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {template.subject && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subject: </span>
                    {editingId === template.id ? (
                      <input
                        type="text"
                        value={editData.subject}
                        onChange={(e) => setEditData(p => ({ ...p, subject: e.target.value }))}
                        style={{ marginTop: 4, width: '100%' }}
                      />
                    ) : (
                      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{template.subject}</span>
                    )}
                  </div>
                )}

                {editingId === template.id ? (
                  <textarea
                    value={editData.body}
                    onChange={(e) => setEditData(p => ({ ...p, body: e.target.value }))}
                    rows={6}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                ) : (
                  <div style={{ 
                    padding: 16, 
                    background: 'var(--bg-base)', 
                    borderRadius: 10, 
                    border: '1px solid var(--border-subtle)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {template.body}
                  </div>
                )}
              </div>
            ))}
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
        <Link href="/ceh" style={{ color: '#f59e0b', textDecoration: 'none' }}>← Back to CEH</Link>
      </footer>
    </div>
  );
}
