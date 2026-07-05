'use client';

import { ArrowLeft, X } from '@/components/icons/lucide';
import type { TourStep } from '@/lib/tour/types';

const CARD_WIDTH = 300;
const GAP = 14;

function cardPosition(rect: DOMRect, placement: TourStep['placement']) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const style: React.CSSProperties = { position: 'fixed', width: CARD_WIDTH };
  const clampX = (x: number) => Math.min(Math.max(x, 12), vw - CARD_WIDTH - 12);

  switch (placement) {
    case 'top':
      style.left = clampX(rect.left + rect.width / 2 - CARD_WIDTH / 2);
      style.bottom = Math.max(12, vh - rect.top + GAP);
      return { style, tail: 'bottom' as const };
    case 'left':
      style.right = Math.max(12, vw - rect.left + GAP);
      style.top = Math.min(Math.max(rect.top + rect.height / 2 - 40, 12), vh - 200);
      return { style, tail: 'right' as const };
    case 'right':
      style.left = Math.min(rect.right + GAP, vw - CARD_WIDTH - 12);
      style.top = Math.min(Math.max(rect.top + rect.height / 2 - 40, 12), vh - 200);
      return { style, tail: 'left' as const };
    case 'bottom':
    default:
      style.left = clampX(rect.left + rect.width / 2 - CARD_WIDTH / 2);
      style.top = Math.min(rect.bottom + GAP, vh - 220);
      return { style, tail: 'top' as const };
  }
}

export default function TourCard({
  step, rect, index, total, onBack, onNext, onSkip, isLast,
}: {
  step: TourStep;
  rect: DOMRect | null;
  index: number;
  total: number;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
}) {
  const { style, tail } = rect
    ? cardPosition(rect, step.placement)
    : { style: { position: 'fixed' as const, left: '50%', top: '50%', width: CARD_WIDTH, transform: 'translate(-50%, -50%)' }, tail: null };

  return (
    <>
      {rect && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 10,
            boxShadow: '0 0 0 3px var(--accent-primary), 0 0 0 9999px rgba(15, 23, 42, 0.35)',
            pointerEvents: 'none',
            zIndex: 9998,
            transition: 'left .2s ease, top .2s ease, width .2s ease, height .2s ease',
          }}
        />
      )}
      <div
        role="dialog"
        aria-label={step.title}
        style={{
          ...style,
          zIndex: 9999,
          background: 'var(--bg-card)',
          borderRadius: 'var(--card-radius)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--card-shadow-lg)',
          padding: '16px 18px',
          transition: rect ? 'left .2s ease, top .2s ease, bottom .2s ease, right .2s ease' : undefined,
        }}
      >
        {tail && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: 12,
              height: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              transform: 'rotate(45deg)',
              ...(tail === 'top' ? { top: -7, left: '50%', marginLeft: -6, borderRight: 'none', borderBottom: 'none' } : {}),
              ...(tail === 'bottom' ? { bottom: -7, left: '50%', marginLeft: -6, borderLeft: 'none', borderTop: 'none' } : {}),
              ...(tail === 'left' ? { left: -7, top: '50%', marginTop: -6, borderRight: 'none', borderTop: 'none' } : {}),
              ...(tail === 'right' ? { right: -7, top: '50%', marginTop: -6, borderLeft: 'none', borderBottom: 'none' } : {}),
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-platform-mono)' }}>
            {index + 1}/{total}
          </span>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close tour"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, lineHeight: 0 }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{step.title}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>{step.body}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Previous step"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none',
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 4px',
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : <span />}

          <button
            type="button"
            onClick={onNext}
            style={{
              background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
