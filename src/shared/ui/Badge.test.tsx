import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('usa tokens de DESIGN.md seguros en claro y oscuro', () => {
    const { rerender } = render(<Badge variant="affinity">92 %</Badge>);
    expect(screen.getByText('92 %')).toHaveClass('bg-primary-soft', 'text-primary-dark');

    rerender(<Badge variant="accent">Top 1</Badge>);
    expect(screen.getByText('Top 1')).toHaveClass('bg-accent', 'text-on-accent');

    rerender(<Badge variant="success">Verificado</Badge>);
    expect(screen.getByText('Verificado')).toHaveClass(
      'bg-surface-sunken',
      'border-line',
      'text-success-ink',
    );
  });
});
