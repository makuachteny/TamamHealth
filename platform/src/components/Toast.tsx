'use client';

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from '@/components/icons/lucide';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
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
        aria-label="Notifications"
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
              background: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              color: 'white',
              border: `1px solid ${toast.type === 'success' ? '#15B8A6' : '#F87171'}`,
              borderRadius: 'var(--card-radius)',
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            )}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
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
