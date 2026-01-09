'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ArrowLeft, FileText, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  subject?: string;
  body: string;
  createdAt: string;
}

export default function CEHAdminPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', body: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplates = async (updatedTemplates: Template[]) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ceh-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: updatedTemplates }),
      });
      
      if (res.ok) {
        setTemplates(updatedTemplates);
        setMessage({ type: 'success', text: 'Templates saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save templates' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const addTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.body.trim()) {
      setMessage({ type: 'error', text: 'Name and body are required' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const template: Template = {
      id: Date.now().toString(),
      name: newTemplate.name.trim(),
      subject: newTemplate.subject.trim() || undefined,
      body: newTemplate.body.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [...templates, template];
    saveTemplates(updated);
    setNewTemplate({ name: '', subject: '', body: '' });
    setShowAddForm(false);
  };

  const deleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      const updated = templates.filter(t => t.id !== id);
      saveTemplates(updated);
    }
  };

  const updateTemplate = (id: string, field: string, value: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const saveTemplate = (id: string) => {
    saveTemplates(templates);
    setEditingId(null);
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
            The AI will analyze your templates' structure, tone, and flow — but will never copy the content directly. 
            Subject lines are optional; the AI will always generate unique subject lines.
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
              New Template
            </h3>
            
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
                }}
              >
                <Save size={16} />
                Save Template
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTemplate({ name: '', subject: '', body: '' }); }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
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
                        value={template.name}
                        onChange={(e) => updateTemplate(template.id, 'name', e.target.value)}
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
                        onClick={() => saveTemplate(template.id)}
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
                        onClick={() => setEditingId(template.id)}
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
                        value={template.subject || ''}
                        onChange={(e) => updateTemplate(template.id, 'subject', e.target.value)}
                        style={{ marginTop: 4, width: '100%' }}
                      />
                    ) : (
                      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{template.subject}</span>
                    )}
                  </div>
                )}

                {editingId === template.id ? (
                  <textarea
                    value={template.body}
                    onChange={(e) => updateTemplate(template.id, 'body', e.target.value)}
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
