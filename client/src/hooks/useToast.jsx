import { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, description = '', variant = 'info', duration = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, description, variant }]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
      return id;
    },
    [dismissToast]
  );

  const toast = {
    success: (title, description) =>
      addToast({ title, description, variant: 'success' }),
    error: (title, description) =>
      addToast({ title, description, variant: 'error', duration: 6000 }),
    info: (title, description) =>
      addToast({ title, description, variant: 'info' }),
    warning: (title, description) =>
      addToast({ title, description, variant: 'warning', duration: 6000 }),
  };

  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    error: 'border-rose-200 bg-rose-50 text-rose-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    info: 'border-slate-200 bg-white text-slate-900',
  };

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />,
    info: <Info className="h-5 w-5 text-teal-600 shrink-0" />,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-all ${styles[t.variant] || styles.info}`}
          >
            {icons[t.variant] || icons.info}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{t.title}</p>
              {t.description ? (
                <p className="mt-1 text-xs opacity-90 leading-relaxed">
                  {t.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 opacity-60 hover:opacity-100 focus-visible:outline-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

