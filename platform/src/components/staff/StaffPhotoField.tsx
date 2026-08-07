'use client';

/**
 * The photo control on a staff form.
 *
 * Wraps the existing `PhotoCaptureModal` — the same camera-or-upload flow
 * patient registration already uses, including its 640px downscale — so a
 * staff photo is stored exactly like a patient one and there is only one piece
 * of capture code to get right.
 *
 * Used both when an admin creates an account and when someone edits their own
 * profile, which is why removing is as prominent as adding: the person in the
 * picture must be able to take it down without filing a ticket.
 */

import { useState } from 'react';
import { Camera, Trash2 } from '@/components/icons/lucide';
import PhotoCaptureModal from '@/components/patients/PhotoCaptureModal';
import StaffAvatar from './StaffAvatar';

export default function StaffPhotoField({
  name, value, onChange, size = 72, label = 'Photo', hint,
}: {
  name: string;
  value?: string;
  /** `null` clears the photo. */
  onChange: (next: string | null) => void;
  size?: number;
  label?: string;
  hint?: string;
}) {
  const [capturing, setCapturing] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <StaffAvatar name={name || '?'} photoUrl={value} size={size} rounded="card" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCapturing(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Camera size={15} aria-hidden />
            {value ? 'Change photo' : 'Add photo'}
          </button>
          {value && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onChange(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Trash2 size={15} aria-hidden />
              Remove
            </button>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {hint || 'Shown on worklists, the schedule and the staff directory.'}
        </span>
      </div>

      {capturing && (
        <PhotoCaptureModal
          onCapture={dataUrl => { onChange(dataUrl); setCapturing(false); }}
          onClose={() => setCapturing(false)}
        />
      )}
    </div>
  );
}
