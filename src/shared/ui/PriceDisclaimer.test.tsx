import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '@/app/i18n';
import { PriceDisclaimer } from './PriceDisclaimer';

describe('PriceDisclaimer', () => {
  it('muestra el texto RL-03 traducido y admite texto con fecha personalizada', async () => {
    const { rerender } = render(<PriceDisclaimer />);
    expect(
      screen.getByText(
        'Precio referencial obtenido de terceros; se confirma en el sitio del vendedor.',
      ),
    ).toBeInTheDocument();

    await i18n.changeLanguage('en');
    rerender(<PriceDisclaimer />);
    expect(
      screen.getByText(
        "Reference price obtained from third parties; confirmed on the seller's site.",
      ),
    ).toBeInTheDocument();

    rerender(<PriceDisclaimer text="Precio del 2026-10-15; puede haber cambiado." />);
    expect(screen.getByText('Precio del 2026-10-15; puede haber cambiado.')).toBeInTheDocument();
  });
});
