import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { StatusMessage } from './StatusMessage';

describe('StatusMessage', () => {
  it('usa role="status" en vacío/info y role="alert" en error con acción', () => {
    const { rerender } = render(
      <StatusMessage
        variant="empty"
        title="Sin itinerarios"
        description="Guarda un vuelo para verlo aquí."
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Sin itinerarios');

    rerender(
      <StatusMessage
        variant="error"
        title="No pudimos conectar"
        action={<Button variant="secondary">Reintentar</Button>}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
