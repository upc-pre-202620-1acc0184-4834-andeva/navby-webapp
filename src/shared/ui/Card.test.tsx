import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('aplica tokens de borde y sombra según variante', () => {
    const { rerender } = render(<Card data-testid="card">Contenido</Card>);
    expect(screen.getByTestId('card')).toHaveClass('bg-surface', 'border-line', 'p-4');

    rerender(
      <Card data-testid="card" variant="elevated" padding="none">
        Elevado
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass('shadow-lg');
    expect(screen.getByTestId('card')).not.toHaveClass('p-4');

    rerender(
      <Card data-testid="card" variant="highlighted">
        Destacado
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass('border-primary');
  });
});
