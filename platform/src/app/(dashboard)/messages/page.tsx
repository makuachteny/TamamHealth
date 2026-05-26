'use client';

import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import SendMessageModal, { type MessageRecipient } from '@/components/SendMessageModal';
import EmptyState from '@/components/EmptyState';
import { useMessages } from '@/lib/hooks/useMessages';
import { usePatients } from '@/lib/hooks/usePatients';
import { useUsers } from '@/lib/hooks/useUsers';
import {
  MessageSquare, Search, Plus, Smartphone, Radio,
  CheckCircle2, Clock, XCircle, Filter, Stethoscope, User,
} from '@/components/icons/lucide';
import {
  ROLE_TITLE,
  ROLE_LABEL,
  PHYSICIAN_ROLES,
  CLINICAL_ROLES,
  formatStaffName,
} from '@/lib/role-display';
import type { UserRole } from '@/lib/db-types';

type ContactTab = 'doctors' | 'staff' | 'patients';

export default function MessagesPage() {
  const { messages, loading } = useMessages();
  const { patients } = usePatients();
  const { users } = useUsers();
  const router = useRouter();

  // Inbox filters
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'app' | 'sms' | 'both'>('all');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'patient' | 'staff' | 'inbound'>('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [recipient, setRecipient] = useState<MessageRecipient | null>(null);

  // Contact picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<ContactTab>('doctors');
  const [pickerQuery, setPickerQuery] = useState('');

  // Patient-originated messages — direction is the canonical marker, but
  // we also accept the legacy `fromDoctorId === 'patient'` shape for docs
  // written before the direction field existed.
  const isInbound = (m: typeof messages[number]) =>
    m.direction === 'patient_to_staff' || m.fromDoctorId === 'patient';

  const filtered = messages.filter(m => {
    if (channelFilter !== 'all' && m.channel !== channelFilter) return false;
    if (recipientFilter === 'inbound') {
      if (!isInbound(m)) return false;
    } else if (recipientFilter !== 'all') {
      const rType = m.recipientType || 'patient';
      if (rType !== recipientFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.patientName.toLowerCase().includes(q) && !m.body.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Contact picker — unified patients + staff list ─────────────────────
  const physicians = useMemo(
    () => users
      .filter(u => u.isActive !== false && PHYSICIAN_ROLES.includes(u.role))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  const clinicalStaff = useMemo(
    () => users
      .filter(u => u.isActive !== false && CLINICAL_ROLES.includes(u.role))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const pickerResults = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (pickerTab === 'patients') {
      const list = patients.filter(p => {
        if (!q) return true;
        const fullName = `${p.firstName} ${p.middleName || ''} ${p.surname}`.toLowerCase();
        return (
          fullName.includes(q) ||
          (p.phone || '').toLowerCase().includes(q) ||
          (p.hospitalNumber || '').toLowerCase().includes(q)
        );
      });
      return list.slice(0, 30);
    }
    const sourceUsers = pickerTab === 'doctors' ? physicians : clinicalStaff;
    const list = sourceUsers.filter(u => {
      if (!q) return true;
      const haystack = [
        u.name,
        u.username,
        u.role,
        ROLE_LABEL[u.role] || '',
        u.department || '',
        u.specialty || '',
        u.hospitalName || '',
        u.phone || '',
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    return list.slice(0, 30);
  }, [pickerTab, pickerQuery, patients, physicians, clinicalStaff]);

  // ── Picker actions ─────────────────────────────────────────────────────
  const openPicker = () => {
    setShowPicker(true);
    setPickerQuery('');
    setPickerTab('doctors');
  };

  const selectPatient = (p: typeof patients[number]) => {
    const fullName = `${p.firstName} ${p.middleName || ''} ${p.surname}`.replace(/\s+/g, ' ').trim();
    setRecipient({
      _id: p._id,
      name: fullName,
      phone: p.phone || '',
      type: 'patient',
      subtitle: `Patient · ${p.hospitalNumber || 'No record #'}`,
    });
    setShowPicker(false);
    setShowModal(true);
  };

  const selectStaff = (u: typeof users[number]) => {
    const displayName = formatStaffName(u.role, u.name);
    const subtitleParts = [
      ROLE_LABEL[u.role] || u.role,
      u.specialty,
      u.department,
      u.hospitalName,
    ].filter(Boolean) as string[];
    setRecipient({
      _id: u._id,
      name: displayName,
      phone: u.phone || '',
      type: 'staff',
      subtitle: subtitleParts.join(' · '),
      role: u.role,
      department: u.department,
      hospitalId: u.hospitalId,
      hospitalName: u.hospitalName,
    });
    setShowPicker(false);
    setShowModal(true);
  };

  // ── Render helpers ─────────────────────────────────────────────────────
  const statusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />;
      case 'sent': return <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />;
      case 'failed': return <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />;
      default: return null;
    }
  };

  const channelLabel = (ch: string) => {
    switch (ch) {
      case 'app':  return <span className="flex items-center gap-2 text-xs"><span className="icon-box-sm" style={{ background: 'var(--accent-light)' }}><Smartphone className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /></span> App</span>;
      case 'sms':  return <span className="flex items-center gap-2 text-xs"><span className="icon-box-sm" style={{ background: 'rgba(31,157,111,0.12)' }}><MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} /></span> SMS</span>;
      case 'both': return <span className="flex items-center gap-2 text-xs"><span className="icon-box-sm" style={{ background: 'rgba(228,168,75,0.16)' }}><Radio className="w-3.5 h-3.5" style={{ color: '#B8741C' }} /></span> Both</span>;
      default:     return ch;
    }
  };

  const initialsFrom = (name: string) =>
    name
      .replace(/^(Dr\.|CO\.|Pharm\.|Nurse|Lab|RD|Sup\.|BHW|HRIO|CHV)\s+/i, '')
      .split(' ')
      .map(p => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <>
      <TopBar title="Messages" />
      <main className="page-container page-enter">
        <PageHeader
          icon={MessageSquare}
          title="Messages"
          subtitle="Send messages to patients, doctors, and clinical staff via app or SMS"
          actions={
            <button onClick={openPicker} className="btn btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Message
            </button>
          }
        />

        {/* Inbox filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div
            className="flex items-center gap-2 flex-1 min-w-[220px] px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-light)' }}
          >
            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name or message..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          {/* Recipient-type filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 mr-1" style={{ color: 'var(--text-muted)' }} />
            {(['all', 'inbound', 'patient', 'staff'] as const).map(rf => (
              <button
                key={rf}
                onClick={() => setRecipientFilter(rf)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: recipientFilter === rf ? 'var(--accent-light)' : 'transparent',
                  color: recipientFilter === rf ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                {rf === 'all' ? 'All' : rf === 'inbound' ? 'From Patients' : rf === 'patient' ? 'Patients' : 'Staff'}
              </button>
            ))}
          </div>

          {/* Channel filter */}
          <div className="flex items-center gap-1">
            {(['all', 'app', 'sms', 'both'] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: channelFilter === ch ? 'var(--accent-light)' : 'transparent',
                  color: channelFilter === ch ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                {ch === 'all' ? 'All Channels' : ch.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <hr className="section-divider" />

        {/* Messages Table */}
        <div className="card-elevated overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading messages...</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              message="Send appointment reminders, lab results, or quick messages to patients, doctors, and clinical staff."
              action={{ label: 'Send a message', onClick: openPicker }}
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Message</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>From</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(msg => {
                  const inbound = isInbound(msg);
                  // For inbound (patient → staff) messages, the patient is the
                  // sender; everything else uses recipientType to decide if
                  // the contact column shows a staff member or a patient.
                  const isStaffMsg = !inbound && (msg.recipientType || 'patient') === 'staff';
                  const contactSubtitle = inbound
                    ? msg.patientPhone || msg.recipientDepartment || ''
                    : isStaffMsg
                      ? [msg.recipientRole && (ROLE_LABEL[msg.recipientRole as UserRole] || msg.recipientRole), msg.recipientDepartment, msg.recipientHospitalName]
                          .filter(Boolean).join(' · ')
                      : msg.patientPhone;
                  // Inbound rows also navigate to the patient profile so the
                  // staff member can pull up history before replying.
                  const goToPatient = (inbound || !isStaffMsg) && msg.patientId
                    ? () => router.push(`/patients/${msg.patientId}`)
                    : undefined;
                  const handleReply = (e: ReactMouseEvent) => {
                    e.stopPropagation();
                    setRecipient({
                      _id: msg.patientId,
                      name: msg.patientName,
                      phone: msg.patientPhone || '',
                      type: 'patient',
                      subtitle: msg.recipientDepartment ? `Patient · ${msg.recipientDepartment}` : 'Patient',
                    });
                    setShowModal(true);
                  };
                  return (
                    <tr
                      key={msg._id}
                      className={goToPatient ? 'cursor-pointer' : ''}
                      onClick={() => { if (goToPatient) goToPatient(); }}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className="icon-box-sm"
                            style={{
                              background: isStaffMsg ? 'var(--accent-light)' : 'rgba(217, 110, 89, 0.14)',
                              color: isStaffMsg ? 'var(--accent-primary)' : '#D96E59',
                            }}
                          >
                            {isStaffMsg
                              ? <Stethoscope className="w-3.5 h-3.5" />
                              : <User className="w-3.5 h-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{msg.patientName}</p>
                            <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{contactSubtitle}</p>
                          </div>
                          {inbound && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                              style={{
                                background: 'rgba(217, 110, 89, 0.14)',
                                color: '#D96E59',
                              }}
                              title="Patient-originated message via patient portal"
                            >
                              Patient → Facility
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="max-w-xs">
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{msg.subject}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{msg.body}</p>
                        </div>
                      </td>
                      <td>{channelLabel(msg.channel)}</td>
                      <td>
                        <span className="flex items-center gap-1.5 text-xs font-medium capitalize">
                          {statusIcon(msg.status)} {msg.status}
                        </span>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{msg.fromDoctorName}</td>
                      <td className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {new Date(msg.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        {inbound && (
                          <button
                            onClick={handleReply}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                          >
                            Reply
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Unified Contact Picker ─────────────────────────────────────── */}
      {showPicker && (
        <div className="modal-backdrop" onClick={() => setShowPicker(false)}>
          <div
            className="modal-content card-elevated"
            style={{ maxWidth: 560, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-4"
              style={{ borderBottom: '1px solid var(--border-light)' }}
            >
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>New Message</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>

            {/* Tabs */}
            <div className="flex" style={{ borderBottom: '1px solid var(--border-light)' }}>
              {([
                { key: 'doctors',  label: 'Doctors',  count: physicians.length },
                { key: 'staff',    label: 'All Staff', count: clinicalStaff.length },
                { key: 'patients', label: 'Patients', count: patients.length },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setPickerTab(t.key)}
                  className="flex-1 py-2.5 text-xs font-semibold transition-colors"
                  style={{
                    color: pickerTab === t.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                    borderBottom: pickerTab === t.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                  <span
                    className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: pickerTab === t.key ? 'var(--accent-light)' : 'var(--overlay-subtle)',
                      color: pickerTab === t.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-3">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
              >
                <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={
                    pickerTab === 'patients'
                      ? 'Search patients by name, phone, hospital #...'
                      : pickerTab === 'doctors'
                        ? 'Search doctors by name, specialty, department, hospital...'
                        : 'Search staff by name, role, department, hospital...'
                  }
                  value={pickerQuery}
                  onChange={e => setPickerQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>

              <div
                className="mt-3 max-h-80 overflow-y-auto"
                style={{ borderRadius: 8 }}
              >
                {pickerTab === 'patients' ? (
                  pickerResults.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                      No patients match.
                    </p>
                  ) : (
                    (pickerResults as typeof patients).map(p => (
                      <button
                        key={p._id}
                        onClick={() => selectPatient(p)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: 'rgba(217, 110, 89, 0.14)',
                            color: '#D96E59',
                          }}
                        >
                          {initialsFrom(`${p.firstName} ${p.surname}`)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {`${p.firstName} ${p.middleName || ''} ${p.surname}`.replace(/\s+/g, ' ').trim()}
                          </p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {[p.phone, p.hospitalNumber, p.gender, p.dateOfBirth && `DOB ${p.dateOfBirth}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: 'rgba(217, 110, 89, 0.14)',
                            color: '#D96E59',
                          }}
                        >
                          PATIENT
                        </span>
                      </button>
                    ))
                  )
                ) : (
                  pickerResults.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                      {pickerTab === 'doctors' ? 'No doctors match.' : 'No staff match.'}
                    </p>
                  ) : (
                    (pickerResults as typeof users).map(u => {
                      const displayName = formatStaffName(u.role, u.name);
                      const roleLabel = ROLE_LABEL[u.role] || u.role;
                      const subtitleBits = [
                        u.specialty,
                        u.department,
                        u.hospitalName,
                      ].filter(Boolean) as string[];
                      return (
                        <button
                          key={u._id}
                          onClick={() => selectStaff(u)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors"
                          style={{ background: 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-subtle)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{
                              background: 'var(--accent-light)',
                              color: 'var(--accent-primary)',
                            }}
                          >
                            {initialsFrom(displayName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {displayName}
                              </p>
                              {u.phone && (
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  · {u.phone}
                                </span>
                              )}
                            </div>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {subtitleBits.length > 0 ? subtitleBits.join(' · ') : roleLabel}
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: 'var(--accent-light)',
                              color: 'var(--accent-primary)',
                            }}
                          >
                            {(ROLE_TITLE[u.role] || roleLabel).toUpperCase()}
                          </span>
                        </button>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <SendMessageModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setRecipient(null); }}
        recipient={recipient}
      />
    </>
  );
}
