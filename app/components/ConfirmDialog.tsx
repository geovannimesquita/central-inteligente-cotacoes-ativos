"use client";

/**
 * Dialogo de confirmacao para acoes destrutivas (exclusao de regra).
 *
 * Implementado com `role="dialog" aria-modal`: o foco vai para o botao de
 * cancelamento ao abrir, `Escape` fecha e o clique no fundo tambem cancela —
 * ou seja, o caminho seguro e sempre o mais facil.
 */

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-text"
      >
        <h2 className="dialog__title" id="confirm-dialog-title">
          {title}
        </h2>
        <p className="dialog__text" id="confirm-dialog-text">
          {description}
        </p>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} ref={cancelRef}>
            Cancelar
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
