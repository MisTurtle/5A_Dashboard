import { createContext, useContext, useState, useCallback } from "react";
import "./ToastProvider.css";

const ToastContext = createContext();
let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [fadeOutToasts, setFadeOutToasts] = useState([]);

  const showToast = useCallback((message, type = "error") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => { setFadeOutToasts((prev) => prev.concat(id)); }, 4000);
    setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)); setFadeOutToasts((prev) => prev.filter((t) => t.id !== id)); }, 6000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}${fadeOutToasts.includes(t.id) ? ' fade-out' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
