import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

function renderDialog(props: Partial<ConfirmDialogProps> = {}) {
  const handlers = { onConfirm: vi.fn(), onClose: vi.fn() };
  const view = render(
    <ConfirmDialog
      open
      title="¿Eliminar este itinerario?"
      description={<p>LIM → MAD</p>}
      confirmLabel="Eliminar"
      cancelLabel="Cancelar"
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, ...view };
}

describe('ConfirmDialog', () => {
  it('abre como diálogo modal con el foco inicial en Cancelar', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar este itinerario?' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('LIM → MAD');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('cerrado no se muestra', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Cancelar cierra y Eliminar confirma', async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc (cancel) cierra el diálogo y avisa a quien lo abrió', () => {
    const { onClose } = renderDialog();
    const dialog = screen.getByRole('dialog');
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(false);
    // El navegador cierra tras `cancel` y emite `close`.
    fireEvent(dialog, new Event('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirmando: spinner, Cancelar deshabilitado y Esc bloqueado', () => {
    const { onClose } = renderDialog({ pending: true });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveAttribute('aria-busy', 'true');
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('muestra el error y sigue abierto', () => {
    renderDialog({ error: 'No pudimos eliminarlo. Inténtalo de nuevo.' });
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos eliminarlo');
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });

  it('al pasar open a false cierra el diálogo sin llamar a onClose', () => {
    const { onClose, rerender } = renderDialog();
    rerender(
      <ConfirmDialog
        open={false}
        title="t"
        description="d"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {}}
        onClose={onClose}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
