import React, { createContext, useCallback, useContext, useState } from 'react';
import './ToastContext.css';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random();
    const titles = {
      success: 'Listo',
      error: 'Revisa los datos',
      warning: 'Atencion',
      info: 'Informacion',
    };

    setToasts((current) => [
      ...current,
      {
        id,
        message,
        type,
        title: options.title || titles[type] || titles.info,
      },
    ]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, options.duration || 4200);
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">{toast.type === 'success' ? '✓' : toast.type === 'info' ? 'i' : '!'}</span>
            <span className="toast-content">
              <strong>{toast.title}</strong>
              <span>{toast.message}</span>
            </span>
            <button type="button" className="toast-close" onClick={() => closeToast(toast.id)} aria-label="Cerrar notificacion">x</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return context;
};
