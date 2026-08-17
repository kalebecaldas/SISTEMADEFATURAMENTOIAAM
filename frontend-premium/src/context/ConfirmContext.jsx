import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

const ConfirmContext = createContext();

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null); // { title, message, confirmLabel, cancelLabel, variant }
  const resolver = useRef(null);

  // confirm(options) -> Promise<boolean>
  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({
        title: options.title || 'Tem certeza?',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'Confirmar',
        cancelLabel: options.cancelLabel || 'Cancelar',
        variant: options.variant || 'default', // 'default' | 'danger'
      });
    });
  }, []);

  const close = useCallback((result) => {
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
    setState(null);
  }, []);

  // Esc cancela
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-overlay" onClick={() => close(false)}>
          <div
            className={`confirm-dialog ${state.variant}`}
            role="alertdialog"
            aria-modal="true"
            aria-label={state.title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon">
              {state.variant === 'danger' ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
            </div>
            <div className="confirm-title">{state.title}</div>
            {state.message && <div className="confirm-message">{state.message}</div>}
            <div className="confirm-actions">
              <button className="confirm-btn confirm-btn--cancel" onClick={() => close(false)}>
                {state.cancelLabel}
              </button>
              <button className="confirm-btn confirm-btn--confirm" onClick={() => close(true)} autoFocus>
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de um ConfirmProvider');
  return ctx;
};
