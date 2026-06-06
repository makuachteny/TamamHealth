'use client';

import { useState } from 'react';
import { X, Send, MessageSquare, Smartphone, Radio } from '@/components/icons/lucide';
import { useMessages } from '@/lib/hooks/useMessages';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';

export interface MessageRecipient {
  _id: string;
  /** Display name (already-formatted, e.g. "Dr. Wani James" or "Akol Deng"). */
  name: string;
  phone: string;
  type: 'patient' | 'staff';
  /** Subtitle line under the name — e.g. role + department, or hospital number. */
  subtitle?: string;
  // Optional staff fields persisted on the message for filterable history.
  role?: string;
  department?: string;
  hospitalId?: string;
  hospitalName?: string;
}

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: MessageRecipient | null;
}

export default function SendMessageModal({ isOpen, onClose, recipient }: SendMessageModalProps) {
  const { t } = useTranslation();
  const quickMessagesPatient = [
    t('message.quickPatientLabReady'),
    t('message.quickPatientMedReady'),
    t('message.quickPatientFollowUp'),
  ];
  const quickMessagesStaff = [
    t('message.quickStaffReviewResults'),
    t('message.quickStaffUrgentConsult'),
    t('message.quickStaffCoverShift'),
  ];
  const [channel, setChannel] = useState<'app' | 'sms' | 'both'>('app');
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const { send } = useMessages();
  const { currentUser } = useApp();

  if (!isOpen || !recipient) return null;

  const isStaff = recipient.type === 'staff';
  const isSMS = channel === 'sms' || channel === 'both';
  const charCount = body.length;
  const quickMessages = isStaff ? quickMessagesStaff : quickMessagesPatient;

  const handleSend = async () => {
    if (!body.trim() || !currentUser) return;
    // SMS-bearing channels need a real phone number — otherwise the upstream
    // SMS gateway silently drops the request and the user sees a misleading
    // success toast. Validate before send so the user can correct it.
    if (isSMS) {
      const phone = (recipient.phone || '').trim();
      const phonePattern = /^\+?\d[\d\s-]{6,20}$/;
      if (!phone || !phonePattern.test(phone)) {
        setPhoneError(t('message.phoneRequiredForSms'));
        return;
      }
    }
    setPhoneError(null);
    setSending(true);
    try {
      await send({
        // Mark direction explicitly so the staff inbox can distinguish
        // staff-authored replies from patient-originated chat messages.
        direction: isStaff ? 'staff_to_staff' : 'staff_to_patient',
        recipientType: recipient.type,
        patientId: recipient._id,
        patientName: recipient.name,
        patientPhone: recipient.phone,
        recipientRole: recipient.role,
        recipientDepartment: recipient.department,
        recipientHospitalId: recipient.hospitalId,
        recipientHospitalName: recipient.hospitalName,
        fromDoctorId: currentUser._id || `user-${currentUser.username}`,
        fromDoctorName: currentUser.name,
        fromHospitalId: currentUser.hospitalId || currentUser.hospital?._id || '',
        fromHospitalName: currentUser.hospitalName || currentUser.hospital?.name || '',
        subject: subject || (isStaff ? 'Staff message' : 'Message from Doctor'),
        body: body.trim(),
        channel,
        sentAt: new Date().toISOString(),
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setBody('');
        setSubject('');
        setChannel('app');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  const handleQuickMessage = (msg: string) => {
    setBody(msg);
    if (!subject) setSubject(msg);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card-elevated"
        style={{ maxWidth: 540, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '1px solid var(--border-light)' }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {isStaff ? t('message.messageStaff') : t('message.messagePatient')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Recipient */}
          <div>
            <label
              className="text-xs font-medium uppercase tracking-wider mb-1 block"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('message.to')}
            </label>
            <div
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: isStaff ? 'var(--accent-light)' : 'rgba(217, 110, 89, 0.14)',
                  color: isStaff ? 'var(--accent-primary)' : '#D96E59',
                }}
              >
                {recipient.name
                  .replace(/^(Dr\.|CO\.|Pharm\.|Nurse|Lab|RD|Sup\.|BHW|HRIO|CHV)\s+/i, '')
                  .split(' ')
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {recipient.name}
                </p>
                {recipient.subtitle && (
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {recipient.subtitle}
                  </p>
                )}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {recipient.phone || t('message.noPhoneOnFile')}
                </p>
              </div>
            </div>
          </div>

          {/* Channel */}
          <div>
            <label
              className="text-xs font-medium uppercase tracking-wider mb-2 block"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('message.channel')}
            </label>
            <div className="flex gap-2">
              {([
                { value: 'app' as const, label: t('message.channelApp'), icon: Smartphone },
                { value: 'sms' as const, label: t('message.channelSms'), icon: MessageSquare },
                { value: 'both' as const, label: t('message.channelBoth'), icon: Radio },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setChannel(opt.value); setPhoneError(null); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: channel === opt.value ? 'var(--accent-light)' : 'var(--overlay-subtle)',
                    color: channel === opt.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    border:
                      channel === opt.value
                        ? '1px solid var(--accent-border)'
                        : '1px solid var(--border-light)',
                  }}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label
              className="text-xs font-medium uppercase tracking-wider mb-1 block"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('message.subject')}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('message.subjectPlaceholder')}
              className="w-full p-2.5 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg-card-solid)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
              }}
            />
          </div>

          {/* Quick Messages */}
          <div>
            <label
              className="text-xs font-medium uppercase tracking-wider mb-2 block"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('message.quickMessages')}
            </label>
            <div className="flex flex-wrap gap-2">
              {quickMessages.map((msg) => (
                <button
                  key={msg}
                  onClick={() => handleQuickMessage(msg)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--overlay-subtle)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>

          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('message.message')}
              </label>
              {isSMS && (
                <span
                  className="text-xs"
                  style={{
                    color: charCount > 160 ? 'var(--color-danger)' : 'var(--text-muted)',
                  }}
                >
                  {charCount}/160
                </span>
              )}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('message.bodyPlaceholder')}
              rows={4}
              className="w-full p-3 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg-card-solid)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
              }}
            />
            {isSMS && charCount > 160 && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                {t('message.smsSplitWarning', { parts: Math.ceil(charCount / 160) })}
              </p>
            )}
            {phoneError && (
              <p className="text-xs mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>
                {phoneError}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 p-4"
          style={{ borderTop: '1px solid var(--border-light)' }}
        >
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            {t('action.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="btn btn-primary btn-sm flex items-center gap-2"
            style={{ opacity: !body.trim() || sending ? 0.5 : 1 }}
          >
            {sent ? (
              <>{t('message.sent')}</>
            ) : sending ? (
              <>{t('message.sending')}</>
            ) : (
              <>
                <Send className="w-4 h-4" /> {t('action.sendMessage')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
