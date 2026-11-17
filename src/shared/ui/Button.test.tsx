import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('usa type="button" por defecto y ejecuta onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continuar</Button>);

    const button = screen.getByRole('button', { name: 'Continuar' });
    expect(button).toHaveAttribute('type', 'button');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('aplica estilos de DESIGN.md para variante buy y danger', () => {
    const { rerender } = render(<Button variant="buy">Comprar</Button>);
    expect(screen.getByRole('button', { name: 'Comprar' })).toHaveClass(
      'bg-accent',
      'text-on-accent',
    );

    rerender(<Button variant="danger">Eliminar cuenta</Button>);
    expect(screen.getByRole('button', { name: 'Eliminar cuenta' })).toHaveClass(
      'border-error-ink',
      'text-error-ink',
    );
  });

  it('conserva el texto oculto en loading, marca aria-busy y deshabilita clics', () => {
    render(<Button loading>Buscar</Button>);
    const button = screen.getByRole('button', { name: 'Buscar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Buscar')).toHaveClass('invisible');
  });
});
