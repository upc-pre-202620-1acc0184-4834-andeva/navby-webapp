import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from './i18n';
import { useDocumentTitle } from './useDocumentTitle';

function TitleHarness({ titleKey }: { titleKey?: string }) {
  useDocumentTitle(titleKey);
  return null;
}

describe('useDocumentTitle', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('es');
    });
    document.title = 'Navby';
  });

  it('fija el título localizado por ruta y lo actualiza al cambiar de idioma', async () => {
    const { rerender } = render(<TitleHarness titleKey="routes.titles.billing" />);
    expect(document.title).toBe('Créditos y paquetes · Navby');

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(document.title).toBe('Credits & packs · Navby');

    rerender(<TitleHarness titleKey="routes.titles.home" />);
    expect(document.title).toBe('Search flights · Navby');
  });

  it('usa Navby cuando la ruta no declara titleKey', () => {
    render(<TitleHarness />);
    expect(document.title).toBe('Navby');
  });
});
