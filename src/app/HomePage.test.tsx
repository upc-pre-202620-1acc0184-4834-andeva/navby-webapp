import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('muestra la marca y el texto traducido', () => {
    render(<HomePage />);
    expect(screen.getAllByAltText('Navby')).toHaveLength(2);
    expect(screen.getByText(/El mejor vuelo/)).toBeInTheDocument();
  });
});
