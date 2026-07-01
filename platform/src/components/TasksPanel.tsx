'use client';

/**
 * Personal task panel — the HealthBridge "tasks" list that replaces the sticky
 * note: quick to-dos with an optional reminder date, complete / reschedule /
 * delete, and a collapsible completed section. Opened from the TopBar.
 */
import { useState } from 'react';
import Modal from '@/components/Modal';
import { CheckCircle2, Check, Clock, Calendar, Plus, Trash2, X } from '@/components/icons/lucide';
import { useTasks } from '@/lib/hooks/useTasks';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dueLabel(due?: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = todayISO();
  if (due < today) return { text: `Overdue · ${due}`, overdue: true };
  if (due === today) return { text: 'Today', overdue: false };
  return { text: due, overdue: false };
}

export default function TasksPanel({ onClose }: { onClose: () => void }) {
  const { open, completed, loading, add, complete, reopen, reschedule, remove } = useTasks();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    await add({ title: title.trim(), dueDate: due || undefined });
    setTitle('');
    setDue('');
  };

  return (
    <Modal onClose={onClose} width={520} align="top">
      <div className="card-elevated" style={{ background: 'var(--bg-card-solid)', borderRadius: 'var(--card-radius)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>My Tasks</h2>
            {open.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}>{open.length}</span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
        </div>

        {/* Add a task */}
        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="Add a task — e.g. phone John"
            className="flex-1 text-sm"
            style={{ padding: '8px 12px', borderRadius: 'var(--input-radius)', background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
          />
          <input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
            title="Reminder date (optional)"
            className="text-sm"
            style={{ padding: '8px 10px', borderRadius: 'var(--input-radius)', background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={submit}
            disabled={!title.trim()}
            aria-label="Add task"
            className="p-2 rounded-lg flex-shrink-0"
            style={{ background: title.trim() ? 'var(--accent-primary)' : 'var(--overlay-subtle)', color: title.trim() ? '#fff' : 'var(--text-muted)' }}
          >
            <Plus className="w-4 h-4" />
          </button>
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
                return (
                  <div key={task._id} className="flex items-start gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                    <button
                      onClick={() => complete(task._id)}
                      aria-label="Mark complete"
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{ border: '1.5px solid var(--border-medium)', color: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'transparent'; }}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {task.priority === 'high' && <span className="text-[var(--color-danger)] mr-1">●</span>}
                        {task.title}
                      </div>
                      {task.patientName && <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>re: {task.patientName}</div>}
                      <div className="flex items-center gap-2 mt-1">
                        <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: d?.overdue ? 'var(--color-danger)' : 'var(--text-muted)' }} title="Reschedule">
                          {d?.overdue ? <Clock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                          <span>{d ? d.text : 'No date'}</span>
                          <input type="date" value={task.dueDate || ''} onChange={e => reschedule(task._id, e.target.value)} className="sr-only" />
                        </label>
                      </div>
                    </div>
                    <button onClick={() => remove(task._id)} aria-label="Delete task" className="p-1 rounded flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <button onClick={() => setShowDone(s => !s)} className="w-full text-left px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', background: 'var(--overlay-subtle)' }}>
                {showDone ? '▾' : '▸'} Completed ({completed.length})
              </button>
              {showDone && completed.map(task => (
                <div key={task._id} className="flex items-center gap-3 px-5 py-2.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <button onClick={() => reopen(task._id)} aria-label="Reopen task" className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                    <Check className="w-3 h-3" />
                  </button>
                  <span className="flex-1 text-[13px] line-through" style={{ color: 'var(--text-muted)' }}>{task.title}</span>
                  <button onClick={() => remove(task._id)} aria-label="Delete task" className="p-1 rounded flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
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
