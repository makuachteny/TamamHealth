'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <html>
      <body style={{ background: '#0f1117', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
          <div style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{t('globalError.title')}</h2>
            <p style={{ fontSize: '14px', color: '#8A9E9A', marginBottom: '24px' }}>
              {t('globalError.description')}
            </p>
            <button
              onClick={reset}
              style={{
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('globalError.tryAgain')}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
