'use client';

/**
 * Personal task panel — the HealthBridge "tasks" list that replaces the sticky
 * note: quick to-dos with an optional reminder date, create / edit / complete /
 * reschedule / delete, and a collapsible completed section. Opened from the
 * TopBar.
 *
 * Layout note: the global `input { width: 100% }` rule in globals.css means any
 * input dropped in a flex row claims the whole row. Every field here therefore
 * sets its own width/flex explicitly — otherwise the date field swallows the
 * row and the title field collapses to nothing (which it did).
 */
import { useState } from 'react';
import Modal from '@/components/Modal';
import { CheckCircle2, Check, Clock, Calendar, Plus, Trash2, X, Flag, Pencil } from '@/components/icons/lucide';
import { toIsoDate } from '@/components/ehr/EhrMiniCalendar';
import { useTasks } from '@/lib/hooks/useTasks';
import type { ClinicianTaskDoc } from '@/lib/db-types';

/** Client-local "today" — never the UTC slice, which flips a day early in Juba. */
function todayISO(): string {
  return toIsoDate(new Date());
}

function dueLabel(due?: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = todayISO();
  if (due < today) return { text: `Overdue · ${due}`, overdue: true };
  if (due === today) return { text: 'Today', overdue: false };
  return { text: due, overdue: false };
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--input-radius)',
  background: 'var(--overlay-subtle)',
  border: '1px solid var(--border-medium)',
  color: 'var(--text-primary)',
};

export default function TasksPanel({ onClose }: { onClose: () => void }) {
  const { open, completed, loading, add, complete, reopen, reschedule, update, remove } = useTasks();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [high, setHigh] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await add({ title: title.trim(), dueDate: due || undefined, priority: high ? 'high' : 'normal' });
      setTitle('');
      setDue('');
      setHigh(false);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (task: ClinicianTaskDoc) => {
    setEditingId(task._id);
    setEditTitle(task.title);
  };

  const commitEdit = async (task: ClinicianTaskDoc) => {
    const next = editTitle.trim();
    setEditingId(null);
    if (!next || next === task.title) return;
    await update(task._id, { title: next });
  };

  return (
    <Modal onClose={onClose} width={520} align="top" labelledBy="tasks-panel-title">
      <div className="card-elevated" style={{ background: 'var(--bg-card-solid)', borderRadius: 'var(--card-radius)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <h2 id="tasks-panel-title" className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>My Tasks</h2>
            {open.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}>{open.length}</span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
        </div>

        {/* Add a task */}
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="Add a task — e.g. phone John"
              aria-label="Task title"
              className="text-sm"
              style={{ ...fieldStyle, flex: '1 1 auto', width: 'auto', minWidth: 0 }}
            />
            <button
              onClick={submit}
              disabled={!title.trim() || busy}
              aria-label="Add task"
              className="p-2 rounded-lg flex-shrink-0"
              style={{ background: title.trim() ? 'var(--accent-primary)' : 'var(--overlay-subtle)', color: title.trim() ? '#fff' : 'var(--text-muted)', cursor: title.trim() ? 'pointer' : 'default' }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="date"
              value={due}
              onChange={e => setDue(e.target.value)}
              title="Reminder date (optional)"
              aria-label="Reminder date"
              className="text-[12px]"
              style={{ ...fieldStyle, padding: '6px 10px', width: 150, flex: '0 0 auto' }}
            />
            <button
              type="button"
              onClick={() => setHigh(h => !h)}
              aria-pressed={high}
              title="High priority"
              className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
              style={{
                background: high ? 'var(--color-danger-bg, var(--overlay-subtle))' : 'var(--overlay-subtle)',
                color: high ? 'var(--color-danger)' : 'var(--text-muted)',
                border: `1px solid ${high ? 'var(--color-danger)' : 'var(--border-medium)'}`,
              }}
            >
              <Flag className="w-3.5 h-3.5" />
              High priority
            </button>
          </div>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : open.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ opacity: 0.35 }} />
              <p className="text-sm">No open tasks — you&apos;re clear.</p>
            </div>
          ) : (
            <div>
              {open.map(task => {
                const d = dueLabel(task.dueDate);
                const isEditing = editingId === task._id;
                return (
                  <div key={task._id} className="flex items-start gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                    <button
                      onClick={() => complete(task._id)}
                      aria-label={`Mark "${task.title}" complete`}
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{ border: '1.5px solid var(--border-medium)', color: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'transparent'; }}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          autoFocus
                          onChange={e => setEditTitle(e.target.value)}
                          onBlur={() => commitEdit(task)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(task);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          aria-label="Edit task title"
                          className="text-[13px] font-semibold"
                          style={{ ...fieldStyle, padding: '4px 8px', width: '100%' }}
                        />
                      ) : (
                        <div className="text-[13px] font-semibold flex items-start gap-1.5" style={{ color: 'var(--text-primary)' }}>
                          {task.priority === 'high' && <span style={{ color: 'var(--color-danger)' }} title="High priority">●</span>}
                          <span className="flex-1 break-words">{task.title}</span>
                          <button
                            onClick={() => startEdit(task)}
                            aria-label={`Edit "${task.title}"`}
                            title="Edit"
                            className="p-0.5 rounded flex-shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {task.patientName && <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>re: {task.patientName}</div>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {/* The input already shows the exact date, so the badge
                            only earns its place when it says something more. */}
                        {(!d || d.overdue || d.text === 'Today') && (
                          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: d?.overdue ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                            {d?.overdue ? <Clock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                            {d ? (d.overdue ? 'Overdue' : d.text) : 'No date'}
                          </span>
                        )}
                        <input
                          type="date"
                          value={task.dueDate || ''}
                          onChange={e => reschedule(task._id, e.target.value)}
                          title="Reschedule"
                          aria-label={`Reminder date for "${task.title}"`}
                          className="text-[11px]"
                          style={{ ...fieldStyle, padding: '3px 6px', width: 132, flex: '0 0 auto' }}
                        />
                        <button
                          onClick={() => update(task._id, { priority: task.priority === 'high' ? 'normal' : 'high' })}
                          aria-pressed={task.priority === 'high'}
                          aria-label={`Toggle high priority for "${task.title}"`}
                          title={task.priority === 'high' ? 'High priority — click to clear' : 'Mark high priority'}
                          className="p-1 rounded flex-shrink-0"
                          style={{ color: task.priority === 'high' ? 'var(--color-danger)' : 'var(--text-muted)' }}
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => remove(task._id)} aria-label={`Delete "${task.title}"`} className="p-1 rounded flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <button onClick={() => setShowDone(s => !s)} aria-expanded={showDone} className="w-full text-left px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', background: 'var(--overlay-subtle)' }}>
                {showDone ? '▾' : '▸'} Completed ({completed.length})
              </button>
              {showDone && completed.map(task => (
                <div key={task._id} className="flex items-center gap-3 px-5 py-2.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <button onClick={() => reopen(task._id)} aria-label={`Reopen "${task.title}"`} title="Reopen" className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                    <Check className="w-3 h-3" />
                  </button>
                  <span className="flex-1 text-[13px] line-through" style={{ color: 'var(--text-muted)' }}>{task.title}</span>
                  <button onClick={() => remove(task._id)} aria-label={`Delete "${task.title}"`} className="p-1 rounded flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
