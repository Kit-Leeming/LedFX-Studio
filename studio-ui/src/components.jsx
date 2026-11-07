import React, { useId, useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Field({ label, children, hint }) {
  const id = useId();
  let assigned = false;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, (c) => {
        if (
          !assigned &&
          React.isValidElement(c) &&
          ["input", "select", "textarea"].includes(c.type)
        ) {
          assigned = true;
          return React.cloneElement(c, { id });
        }
        return c;
      })}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    const fn = (e) => {
      e.preventDefault();
      if (!busy) onClose();
    };
    d.addEventListener("cancel", fn);
    return () => d.removeEventListener("cancel", fn);
  }, [busy]);
  return (
    <dialog ref={ref} aria-label={title}>
      <div className="modalHead">
        <h2>{title}</h2>
        <button
          type="button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function ErrorBox({ children }) {
  return children ? (
    <div className="error" role="alert">
      {children}
    </div>
  ) : null;
}
