import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mail, Copy, Check, ExternalLink, Plus, Edit2, Trash2, 
  AlertTriangle, Paperclip, Sparkles, ArrowLeft, RefreshCw, FileText
} from 'lucide-react';
import { Shipment, EmailTemplate } from '../types';
import { useAppStore } from '../store/useAppStore';
import { renderEmailTemplate, TEMPLATE_VARIABLES } from '../utils/emailTemplateHelper';
import { defaultEmailTemplates } from '../data/defaultEmailTemplates';

interface EmailTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Partial<Shipment>;
  defaultTemplateId?: string;
}

export function EmailTemplateModal({
  isOpen,
  onClose,
  shipment,
  defaultTemplateId
}: EmailTemplateModalProps) {
  const { emailTemplates, updateEmailTemplates } = useAppStore();
  
  const templates = emailTemplates && emailTemplates.length > 0 ? emailTemplates : defaultEmailTemplates;
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    defaultTemplateId || templates[0]?.id || 'tpl_depo'
  );

  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editAttachments, setEditAttachments] = useState<string[]>([]);
  const [newAttachmentInput, setNewAttachmentInput] = useState('');

  // Active cursor target for inserting placeholder variables
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'body'>('body');
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Copy feedback
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [checkedAttachments, setCheckedAttachments] = useState<Record<string, boolean>>({});

  // Editable preview content
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');

  // In-app confirmation and notification states (avoids native browser confirm/alert in sandbox iframe)
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  // Auto-clear notification messages
  useEffect(() => {
    if (inlineMessage) {
      const timer = setTimeout(() => setInlineMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [inlineMessage]);

  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Render current template when selected template or shipment changes
  useEffect(() => {
    if (currentTemplate) {
      const rendered = renderEmailTemplate(currentTemplate, shipment);
      setPreviewSubject(rendered.subject);
      setPreviewBody(rendered.body);
      setCheckedAttachments({});
    }
  }, [currentTemplate, shipment]);

  // Sync edit form when entering edit mode
  useEffect(() => {
    if (isEditingTemplate && currentTemplate) {
      setEditName(currentTemplate.name);
      setEditSubject(currentTemplate.subject);
      setEditBody(currentTemplate.body);
      setEditAttachments([...(currentTemplate.attachments || [])]);
    }
  }, [isEditingTemplate, currentTemplate]);

  if (!isOpen) return null;

  const renderedResult = currentTemplate 
    ? renderEmailTemplate(currentTemplate, shipment) 
    : { subject: '', body: '', missingPlaceholders: [], attachments: [] };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(previewBody);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopySubject = () => {
    navigator.clipboard.writeText(previewSubject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleOpenMailClient = () => {
    const subjectEncoded = encodeURIComponent(previewSubject);
    const bodyEncoded = encodeURIComponent(previewBody);
    window.location.href = `mailto:?subject=${subjectEncoded}&body=${bodyEncoded}`;
  };

  const handleInsertVariable = (variableKey: string) => {
    if (lastFocusedField === 'subject') {
      const input = subjectInputRef.current;
      if (input) {
        const start = input.selectionStart || editSubject.length;
        const end = input.selectionEnd || editSubject.length;
        const newText = editSubject.substring(0, start) + variableKey + editSubject.substring(end);
        setEditSubject(newText);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + variableKey.length, start + variableKey.length);
        }, 50);
      } else {
        setEditSubject(prev => prev + variableKey);
      }
    } else {
      const textarea = bodyTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart || editBody.length;
        const end = textarea.selectionEnd || editBody.length;
        const newText = editBody.substring(0, start) + variableKey + editBody.substring(end);
        setEditBody(newText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + variableKey.length, start + variableKey.length);
        }, 50);
      } else {
        setEditBody(prev => prev + variableKey);
      }
    }
  };

  const handleAddAttachment = () => {
    const trimmed = newAttachmentInput.trim();
    if (trimmed && !editAttachments.includes(trimmed)) {
      setEditAttachments([...editAttachments, trimmed]);
      setNewAttachmentInput('');
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setEditAttachments(editAttachments.filter((_, i) => i !== idx));
  };

  const handleSaveTemplate = () => {
    if (!editName.trim()) {
      setInlineMessage({ text: 'Lütfen şablon adını girin.', type: 'error' });
      return;
    }

    if (isCreatingNew) {
      const newId = `tpl_${Date.now()}`;
      const newTemplate: EmailTemplate = {
        id: newId,
        name: editName.trim(),
        subject: editSubject.trim(),
        body: editBody,
        attachments: editAttachments,
        order: templates.length + 1
      };
      const updated = [...templates, newTemplate];
      updateEmailTemplates(updated);
      setSelectedTemplateId(newId);
      setIsCreatingNew(false);
      setIsEditingTemplate(false);
      setInlineMessage({ text: `"${newTemplate.name}" şablonu oluşturuldu.`, type: 'success' });
    } else if (currentTemplate) {
      const updated = templates.map(t => {
        if (t.id === currentTemplate.id) {
          return {
            ...t,
            name: editName.trim(),
            subject: editSubject.trim(),
            body: editBody,
            attachments: editAttachments
          };
        }
        return t;
      });
      updateEmailTemplates(updated);
      setIsEditingTemplate(false);
      setInlineMessage({ text: 'Şablon başarıyla güncellendi.', type: 'success' });
    }
  };

  const requestDeleteTemplate = (template: { id: string; name: string }) => {
    if (templates.length <= 1) {
      setInlineMessage({ text: 'En az bir e-posta şablonu kalmalıdır. Bu şablon silinemez.', type: 'error' });
      return;
    }
    setTemplateToDelete(template);
  };

  const executeDeleteTemplate = (idToDelete: string) => {
    if (templates.length <= 1) {
      setInlineMessage({ text: 'En az bir e-posta şablonu kalmalıdır. Bu şablon silinemez.', type: 'error' });
      setTemplateToDelete(null);
      return;
    }
    const updated = templates.filter(t => t.id !== idToDelete);
    updateEmailTemplates(updated);
    if (selectedTemplateId === idToDelete) {
      setSelectedTemplateId(updated[0]?.id || '');
    }
    setTemplateToDelete(null);
    setIsEditingTemplate(false);
    setIsCreatingNew(false);
    setInlineMessage({ text: 'Şablon başarıyla silindi.', type: 'success' });
  };

  const requestResetToDefaults = () => {
    setShowResetConfirm(true);
  };

  const executeResetToDefaults = () => {
    updateEmailTemplates(defaultEmailTemplates);
    setSelectedTemplateId(defaultEmailTemplates[0].id);
    setShowResetConfirm(false);
    setIsEditingTemplate(false);
    setIsCreatingNew(false);
    setInlineMessage({ text: 'Tüm şablonlar varsayılan fabrika ayarlarına sıfırlandı.', type: 'success' });
  };

  const startCreateNew = () => {
    setIsCreatingNew(true);
    setIsEditingTemplate(true);
    setEditName('Yeni E-Posta Şablonu');
    setEditSubject('Konu Başlığı - {BOOKING_NO}');
    setEditBody('Merhaba,\n\nSevkiyat detayları:\n• Booking No: {BOOKING_NO}\n• AWB No: {AWB_NO}\n\nEkteki belgeler:\n{EKLER}\n\nİyi çalışmalar.');
    setEditAttachments(['D7X İrsaliye', 'DI Paketleme']);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/60 dark:bg-black/80 backdrop-blur-xs">
      <div 
        className="bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-800 shadow-2xl rounded-md w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-stone-100 transition-colors"
        role="dialog"
        aria-modal="true"
      >
        {/* MODAL HEADER */}
        <div className="bg-slate-800 dark:bg-[#1c1917] text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-700 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 dark:bg-amber-600 rounded">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                E-POSTA ŞABLONLARI
                {shipment.bookingNo && (
                  <span className="text-xs bg-slate-700 dark:bg-stone-800 text-blue-300 dark:text-amber-300 font-mono px-2 py-0.5 rounded font-normal normal-case">
                    {shipment.bookingNo}
                  </span>
                )}
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Kapat (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TEMPLATE SELECTOR TABS */}
        <div className="bg-slate-100 dark:bg-stone-900 border-b border-slate-300 dark:border-stone-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 py-0.5 min-w-0">
            {templates.map(tpl => {
              const isSelected = tpl.id === selectedTemplateId && !isCreatingNew;
              return (
                <button
                  key={tpl.id}
                  onClick={() => {
                    setSelectedTemplateId(tpl.id);
                    setIsEditingTemplate(false);
                    setIsCreatingNew(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 dark:bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-stone-800 text-slate-700 dark:text-stone-200 hover:bg-slate-200 dark:hover:bg-stone-700 border border-slate-300 dark:border-stone-700'
                  }`}
                >
                  <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-200 dark:text-amber-100' : 'text-slate-500 dark:text-stone-400'}`} />
                  {tpl.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {!isEditingTemplate && (
              <button
                type="button"
                onClick={startCreateNew}
                className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                title="Yeni özel e-posta şablonu oluştur"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Yeni Şablon</span>
              </button>
            )}
            
            {isEditingTemplate ? (
              <button
                type="button"
                onClick={() => {
                  setIsEditingTemplate(false);
                  setIsCreatingNew(false);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-stone-800 hover:bg-slate-300 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-400 dark:border-stone-700 rounded flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Önizlemeye Dön
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditingTemplate(true)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 rounded flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                  title="Bu şablonun metnini ve eklerini özelleştir"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
                  <span className="hidden sm:inline">Şablonu Düzenle</span>
                </button>
                {currentTemplate && (
                  <button
                    type="button"
                    onClick={() => requestDeleteTemplate({ id: currentTemplate.id, name: currentTemplate.name })}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-stone-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:border-red-400 rounded flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                    title="Bu şablonu sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Şablonu Sil</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* INLINE FEEDBACK MESSAGE */}
        {inlineMessage && (
          <div className={`px-4 py-2.5 text-xs flex items-center justify-between border-b shrink-0 ${
            inlineMessage.type === 'error'
              ? 'bg-red-100 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 font-semibold'
              : 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold'
          }`}>
            <div className="flex items-center gap-2">
              {inlineMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              ) : (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span>{inlineMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setInlineMessage(null)}
              className="p-1 text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* INLINE DELETE CONFIRMATION */}
        {templateToDelete && (
          <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-300 dark:border-red-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-red-950 dark:text-red-200 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-200 rounded">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-red-900 dark:text-red-200">Şablonu Silmek İstediğinizden Emin Misiniz?</span>
                <p className="text-[11px] text-red-800 dark:text-red-300">
                  <strong>"{templateToDelete.name}"</strong> adlı e-posta şablonu kalıcı olarak silinecektir.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => executeDeleteTemplate(templateToDelete.id)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Evet, Şablonu Sil
              </button>
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="px-3 py-1.5 bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 font-semibold rounded transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}

        {/* INLINE RESET CONFIRMATION */}
        {showResetConfirm && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200">Varsayılan Şablonlara Sıfırla</span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Tüm şablonlar orijinal fabrika ayarlarına döndürülür. Özel eklediğiniz şablonlar sıfırlanır.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={executeResetToDefaults}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-2xs transition-colors cursor-pointer"
              >
                Evet, Sıfırla
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 font-semibold rounded transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 bg-slate-50 dark:bg-[#141210]">
          
          {/* ================= MODE A: PREVIEW & GENERATOR ================= */}
          {!isEditingTemplate && currentTemplate && (
            <>
              {/* WARNING BANNER FOR MISSING PLACEHOLDERS */}
              {renderedResult.missingPlaceholders.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded p-3 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Eksik Bilgi Uyarısı: </span>
                    Bu şablonda kullanılan aşağıdaki alanlar bu sevkiyatta henüz doldurulmamış:
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {renderedResult.missingPlaceholders.map(m => (
                        <span key={m.key} className="bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {m.label} ({m.key})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ATTACHMENT CHECKLIST */}
              {renderedResult.attachments.length > 0 && (
                <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-md p-3 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
                      Eklenecek Belgeler ({renderedResult.attachments.length})
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {renderedResult.attachments.map((att, idx) => {
                      const isChecked = !!checkedAttachments[att.name];
                      return (
                        <div
                          key={idx}
                          onClick={() => setCheckedAttachments(prev => ({ ...prev, [att.name]: !prev[att.name] }))}
                          className={`flex items-center justify-between p-2 rounded border cursor-pointer select-none transition-all ${
                            isChecked
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                              : att.isProvidedInShipment
                              ? 'bg-slate-50 dark:bg-stone-800 border-slate-300 dark:border-stone-700 hover:border-slate-400 dark:hover:border-stone-600 text-slate-800 dark:text-stone-200'
                              : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent div
                              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                            />
                            <span className={`text-xs font-medium truncate ${isChecked ? 'line-through text-slate-500 dark:text-stone-400' : ''}`}>
                              {att.name}
                            </span>
                          </div>
                          {att.isProvidedInShipment ? (
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold px-1.5 py-0.5 rounded shrink-0">
                              Hazır ✓
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold px-1.5 py-0.5 rounded shrink-0" title="Sevkiyatta ilgili alan boş">
                              Boş
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBJECT LINE */}
              <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-md p-3 shadow-2xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wide">
                    E-Posta Konusu (Subject)
                  </label>
                  <button
                    onClick={handleCopySubject}
                    className="text-xs text-blue-600 dark:text-amber-400 hover:text-blue-800 dark:hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedSubject ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">Konu Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Konuyu Kopyala</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={previewSubject}
                  onChange={e => setPreviewSubject(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-stone-100 focus:bg-white dark:focus:bg-stone-950 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* BODY TEXT */}
              <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-md p-3 shadow-2xs flex flex-col gap-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wide">
                    E-Posta Gövdesi
                  </label>
                </div>
                <textarea
                  value={previewBody}
                  onChange={e => setPreviewBody(e.target.value)}
                  rows={12}
                  className="w-full bg-slate-50 dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded p-3 text-xs sm:text-sm font-sans text-slate-900 dark:text-stone-100 focus:bg-white dark:focus:bg-stone-950 focus:outline-none focus:border-amber-500 leading-relaxed resize-y min-h-[220px]"
                />
              </div>
            </>
          )}

          {/* ================= MODE B: TEMPLATE EDITOR ================= */}
          {isEditingTemplate && (
            <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-md p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-stone-700">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-stone-100 uppercase">
                    {isCreatingNew ? 'Yeni E-Posta Şablonu Oluştur' : `Şablonu Düzenle: ${currentTemplate?.name}`}
                  </h3>
                </div>
                {!isCreatingNew && (
                  <button
                    type="button"
                    onClick={() => requestDeleteTemplate({ id: currentTemplate.id, name: currentTemplate.name })}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 font-semibold flex items-center gap-1 px-2.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Şablonu Sil
                  </button>
                )}
              </div>

              {/* VARIABLE CHIPS HELPER */}
              <div className="bg-amber-50/70 dark:bg-stone-800/80 border border-amber-200 dark:border-stone-700 rounded p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-950 dark:text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Kullanılabilir Değişkenler
                  </span>
                  <span className="text-[10px] text-amber-800 dark:text-amber-400">
                    Hedef: <strong className="uppercase">{lastFocusedField === 'subject' ? 'Konu' : 'Gövde'}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto py-1">
                  {TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleInsertVariable(v.key)}
                      title={`${v.description} (Örn: ${v.sample})`}
                      className="px-2 py-1 bg-white dark:bg-stone-900 hover:bg-amber-600 dark:hover:bg-amber-600 text-amber-900 dark:text-amber-300 hover:text-white dark:hover:text-white border border-amber-300 dark:border-stone-700 rounded text-[11px] font-mono font-semibold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <span>{v.key}</span>
                      <span className="text-[10px] opacity-75 font-sans font-normal">({v.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* FORM FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-stone-300">Şablon Adı</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Örn: Depo Çıkış Maili"
                    className="border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-slate-900 dark:text-stone-100 rounded px-3 py-1.5 text-xs sm:text-sm font-semibold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-stone-300">E-Posta Konu Başlığı (Subject)</label>
                  <input
                    ref={subjectInputRef}
                    type="text"
                    value={editSubject}
                    onFocus={() => setLastFocusedField('subject')}
                    onChange={e => setEditSubject(e.target.value)}
                    placeholder="Örn: Depo Çıkış Talimatı - {D7X_NO}"
                    className="border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-slate-900 dark:text-stone-100 rounded px-3 py-1.5 text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* ATTACHMENTS MANAGER */}
              <div className="flex flex-col gap-2 border border-slate-200 dark:border-stone-700 rounded p-3 bg-slate-50/50 dark:bg-stone-900/50">
                <label className="text-xs font-bold text-slate-700 dark:text-stone-300 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5 text-slate-600 dark:text-stone-400" />
                  Eklenecek Belgeler Listesi
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {editAttachments.map((att, idx) => (
                    <span key={idx} className="bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-800 dark:text-stone-200 text-xs px-2.5 py-1 rounded flex items-center gap-1.5 shadow-2xs font-medium">
                      {att}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newAttachmentInput}
                      onChange={e => setNewAttachmentInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAttachment())}
                      placeholder="Yeni ek adı (örn: D7X İrsaliye)"
                      className="border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-slate-900 dark:text-stone-100 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddAttachment}
                      className="bg-slate-200 dark:bg-stone-700 hover:bg-slate-300 dark:hover:bg-stone-600 text-slate-700 dark:text-stone-200 px-2 py-1 rounded text-xs font-semibold cursor-pointer"
                    >
                      Ekle
                    </button>
                  </div>
                </div>
              </div>

              {/* BODY TEXTAREA */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 dark:text-stone-300">Şablon Metni (Gövde)</label>
                <textarea
                  ref={bodyTextareaRef}
                  value={editBody}
                  onFocus={() => setLastFocusedField('body')}
                  onChange={e => setEditBody(e.target.value)}
                  rows={9}
                  className="w-full border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-slate-900 dark:text-stone-100 rounded p-3 text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-500 leading-relaxed resize-y"
                  placeholder="E-posta metnini yazın ve yukarıdaki değişkenleri kullanın..."
                />
              </div>

              {/* ACTIONS */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={requestResetToDefaults}
                  className="text-xs text-slate-500 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-200 flex items-center gap-1 underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Fabrika Ayarlarına Dön
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTemplate(false);
                      setIsCreatingNew(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-stone-800 hover:bg-slate-300 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 rounded transition-colors cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 dark:bg-amber-600 hover:bg-blue-700 dark:hover:bg-amber-500 text-white rounded shadow-sm transition-colors cursor-pointer"
                  >
                    Şablonu Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 dark:bg-stone-900 border-t border-slate-300 dark:border-stone-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500 dark:text-stone-400">
            {currentTemplate && !isEditingTemplate && (
              <span>Seçili Şablon: <strong className="text-slate-700 dark:text-stone-200">{currentTemplate.name}</strong></span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditingTemplate && (
              <>
                <button
                  onClick={handleOpenMailClient}
                  className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-stone-800 hover:bg-slate-50 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 rounded flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="Varsayılan e-posta uygulamasında aç (Outlook, Mail, vb.)"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600 dark:text-stone-400" />
                  <span>E-Posta Programında Aç</span>
                </button>

                <button
                  onClick={handleCopyBody}
                  className={`px-4 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                    copiedBody 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-blue-600 dark:bg-amber-600 hover:bg-blue-700 dark:hover:bg-amber-500 text-white'
                  }`}
                >
                  {copiedBody ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Metin Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Tüm Metni Kopyala</span>
                    </>
                  )}
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-stone-800 hover:bg-slate-300 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 rounded transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
