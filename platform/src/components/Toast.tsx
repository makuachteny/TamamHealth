'use client';

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { DANGER, DANGER_STRONG, SUCCESS, SUCCESS_STRONG, WHITE } from '@/lib/theme-colors';

/** An inline action rendered as a button in the toast — e.g. Undo. */
export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error', opts?: { action?: ToastAction; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error', opts?: { action?: ToastAction; durationMs?: number }) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, action: opts?.action }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      // A toast carrying an action (Undo) stays up twice as long — it is the
      // recovery window, not just a receipt.
    }, opts?.durationMs ?? (opts?.action ? 8000 : 4000));
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div
        role="region"
        aria-label={t('common.notifications')}
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2"
        style={{ maxWidth: '400px' }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="alert"
            className="flex items-center gap-3 px-4 py-3 shadow-lg animate-fadeInUp"
            style={{
              background: toast.type === 'success' ? SUCCESS : DANGER,
              color: WHITE,
              border: `1px solid ${toast.type === 'success' ? SUCCESS_STRONG : DANGER_STRONG}`,
              borderRadius: 'var(--card-radius)',
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            )}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            {toast.action && (
              <button
                onClick={() => { void toast.action!.onClick(); removeToast(toast.id); }}
                className="px-3 py-1.5 rounded font-semibold text-sm flex-shrink-0 transition-colors"
                style={{ background: 'rgba(255,255,255,0.22)', color: WHITE, border: '1px solid rgba(255,255,255,0.45)' }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              aria-label={t('common.dismissNotification')}
              className="p-1.5 rounded hover:bg-white/20 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
