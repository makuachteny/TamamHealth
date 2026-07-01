'use client';

/**
 * Renders a symptom screening template's questions with one-tap Yes/No/N-A (and
 * select) answers, revealing follow-up questions when the parent answer matches.
 * Controlled: answers live in the parent so they can be compiled into the HPI.
 */
import type { SymptomTemplate, SymptomQuestion, SymptomAnswers } from '@/lib/clinical/symptom-templates';

function YesNo({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const opts: { v: string; label: string }[] = [
    { v: 'yes', label: 'Yes' },
    { v: 'no', label: 'No' },
    { v: 'na', label: 'N/A' },
  ];
  return (
    <div className="flex gap-1.5 flex-shrink-0">
      {opts.map(o => {
        const active = value === o.v;
        const color = o.v === 'yes' ? 'var(--color-success)' : o.v === 'no' ? 'var(--color-danger)' : 'var(--text-muted)';
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(active ? '' : o.v)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md"
            style={{
              border: `1px solid ${active ? color : 'var(--border-medium)'}`,
              background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
              color: active ? color : 'var(--text-muted)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function QuestionRow({ q, answers, onAnswer, depth }: { q: SymptomQuestion; answers: SymptomAnswers; onAnswer: (id: string, v: string) => void; depth: number }) {
  const value = answers[q.id];
  const revealed = q.followUps && q.revealOn !== undefined && value === q.revealOn;
  return (
    <>
      <div className="flex items-center justify-between gap-2 py-1.5" style={{ paddingLeft: depth * 14 }}>
        <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{q.label}</span>
        {q.type === 'yes_no' ? (
          <YesNo value={value} onChange={(v) => onAnswer(q.id, v)} />
        ) : (
          <select
            value={value || ''}
            onChange={(e) => onAnswer(q.id, e.target.value)}
            className="text-[12px] flex-shrink-0"
            style={{ padding: '4px 8px', borderRadius: 'var(--input-radius)', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
          >
            <option value="">—</option>
            {(q.options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
      </div>
      {revealed && (q.followUps || []).map(f => (
        <QuestionRow key={f.id} q={f} answers={answers} onAnswer={onAnswer} depth={depth + 1} />
      ))}
    </>
  );
}

export default function SymptomTemplateForm({
  template,
  answers,
  onAnswer,
}: {
  template: SymptomTemplate;
  answers: SymptomAnswers;
  onAnswer: (id: string, value: string) => void;
}) {
  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
      <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
        {template.questions.map(q => (
          <QuestionRow key={q.id} q={q} answers={answers} onAnswer={onAnswer} depth={0} />
        ))}
      </div>
    </div>
  );
}
