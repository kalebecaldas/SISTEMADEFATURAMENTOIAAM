import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext();

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const DEFAULT_DURATION = 4000;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    // marca como saindo para animar, depois remove
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const show = useCallback((type, title, options = {}) => {
    const id = Date.now() + Math.random();
    const duration = options.duration ?? DEFAULT_DURATION;
    setToasts((prev) => [...prev, { id, type, title, detail: options.detail, leaving: false }]);
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const api = {
    show,
    dismiss,
    success: (title, opts) => show('success', title, opts),
    error: (title, opts) => show('error', title, { duration: 6000, ...opts }),
    warning: (title, opts) => show('warning', title, opts),
    info: (title, opts) => show('info', title, opts),
    // promise(p, { loading, success, error }) — resolve/rejeita com toast automático
    promise: async (promise, msgs = {}) => {
      const loadingId = msgs.loading ? show('info', msgs.loading, { duration: 0 }) : null;
      try {
        const result = await promise;
        if (loadingId) dismiss(loadingId);
        if (msgs.success) {
          show('success', typeof msgs.success === 'function' ? msgs.success(result) : msgs.success);
        }
        return result;
      } catch (err) {
        if (loadingId) dismiss(loadingId);
        const detail = err?.response?.data?.error || err?.message;
        show('error', typeof msgs.error === 'function' ? msgs.error(err) : (msgs.error || 'Erro'), { detail });
        throw err;
      }
    },
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`toast toast--${t.type} ${t.leaving ? 'leaving' : ''}`}
              role={t.type === 'error' ? 'alert' : 'status'}
            >
              <Icon size={18} className="toast-icon" />
              <div className="toast-body">
                <div className="toast-title">{t.title}</div>
                {t.detail && <div className="toast-detail">{t.detail}</div>}
              </div>
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Fechar">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de um ToastProvider');
  return ctx;
};
