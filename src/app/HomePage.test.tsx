import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('muestra el título y el texto traducido del buscador provisional', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Buscador de vuelos' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/El mejor vuelo/)).toBeInTheDocument();
  });
});
