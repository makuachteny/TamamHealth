'use client';

/**
 * The form a patient opens from the link reception sent them.
 *
 * Public route — the person here is a patient with a link, not a platform user,
 * so it deliberately carries no app shell, no nav and no session. Two steps:
 *
 *  1. CONFIRM — surname and date of birth. Nothing about the form or the
 *     patient is shown until the server matches them against the chart, so a
 *     forwarded link or a shared phone reveals nothing on its own.
 *  2. FILL — the lines reception actually requested, then submit.
 *
 * The confirmation details are re-sent with the submit rather than exchanged
 * for a session: there is no token to steal from storage, and the server
 * re-checks on every call (see /api/intake/[token]).
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';

interface OpenedForm {
  greetingName?: string;
  fields: string[];
}

export default function PatientIntakePage() {
  const params = useParams();
  const token = String(params?.token || '');

  const [surname, setSurname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [opened, setOpened] = useState<OpenedForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function call(action: 'open' | 'submit') {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, surname, dateOfBirth, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A 409 means the form is already in, which is an outcome rather than
        // a failure — show the thank-you instead of an error.
        if (data?.done) { setDone(true); return; }
        setError(data?.error || 'Something went wrong. Please try again.');
        return;
      }
      if (action === 'open') setOpened({ greetingName: data.greetingName, fields: data.fields || [] });
      else setDone(true);
    } catch {
      setError('We could not reach the clinic. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pintake">
      <div className="pintake-card">
        {done ? (
          <>
            <h1>Thank you</h1>
            <p>Your answers have been sent to the clinic. There is nothing else to do — staff will go through them before your visit.</p>
          </>
        ) : !opened ? (
          <>
            <h1>Your intake forms</h1>
            <p>To open your forms, please confirm who you are.</p>
            <form
              onSubmit={e => { e.preventDefault(); void call('open'); }}
              className="pintake-form"
            >
              <div>
                <label htmlFor="pi-surname">Surname</label>
                <input
                  id="pi-surname"
                  type="text"
                  autoComplete="family-name"
                  value={surname}
                  onChange={e => setSurname(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="pi-dob">Date of birth</label>
                <input
                  id="pi-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  required
                />
              </div>
              {error && <p className="pintake-error" role="alert">{error}</p>}
              <button type="submit" disabled={busy || !surname || !dateOfBirth}>
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>{opened.greetingName ? `Hello ${opened.greetingName}` : 'Your intake forms'}</h1>
            <p>Please fill in what you can. You can leave anything you are unsure about blank.</p>
            <form
              onSubmit={e => { e.preventDefault(); void call('submit'); }}
              className="pintake-form"
            >
              {opened.fields.map(label => (
                <div key={label}>
                  <label htmlFor={`pi-f-${label}`}>{label}</label>
                  <input
                    id={`pi-f-${label}`}
                    type={label.toLowerCase().includes('date') ? 'date' : 'text'}
                    value={answers[label] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [label]: e.target.value }))}
                  />
                </div>
              ))}
              {error && <p className="pintake-error" role="alert">{error}</p>}
              <button type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send to the clinic'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
