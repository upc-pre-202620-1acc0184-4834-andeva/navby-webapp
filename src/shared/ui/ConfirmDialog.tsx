import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Confirmando: spinner en el botón y ni Cancelar ni `Esc` cierran el diálogo. */
  pending?: boolean;
  /** Error de la confirmación; el diálogo sigue abierto para reintentar. */
  error?: string | null;
  onConfirm: () => void;
  /** Cancelar o `Esc`: quien lo abrió lo cierra poniendo `open` en `false`. */
  onClose: () => void;
}

/**
 * Confirmación destructiva sobre `<dialog>` nativo con `showModal()`: trampa de foco, `Esc` y
 * fondo inerte los pone el navegador. El foco inicial va a Cancelar y al cerrar vuelve a quien
 * lo abrió. Movimiento: `.navby-dialog` en global.css.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // `Esc` también dispara `cancel`: mientras confirma no se puede cerrar.
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      // `close` llega también tras nuestro propio `close()`; solo importa si el cierre fue del navegador.
      onClose={() => {
        if (open) onClose();
      }}
      className="navby-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-6 text-fg shadow-lg"
    >
      <h2 id={titleId} className="text-lg font-semibold text-fg">
        {title}
      </h2>
      <div id={descriptionId} className="mt-2 flex flex-col gap-1 text-sm text-fg-muted">
        {description}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-error-ink">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant="danger" loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
