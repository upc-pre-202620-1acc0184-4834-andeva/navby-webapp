import { act, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme } from './theme';
import { TURNSTILE_DUMMY_TOKEN, TurnstileField } from './TurnstileField';

const mockReset = vi.fn();
const mockPropsSpy = vi.fn();

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: forwardRef(function MockTurnstile(
    props: {
      siteKey: string;
      onSuccess?: (token: string) => void;
      onExpire?: () => void;
      onError?: () => void;
      onTimeout?: () => void;
      options?: { theme?: string; language?: string; action?: string };
    },
    ref,
  ) {
    mockPropsSpy(props);
    useImperativeHandle(ref, () => ({ reset: mockReset }));
    return (
      <div
        data-testid="mock-cf-turnstile"
        data-sitekey={props.siteKey}
        data-theme={props.options?.theme}
        data-language={props.options?.language}
      >
        <button type="button" onClick={() => props.onSuccess?.('live-cf-token')}>
          solve
        </button>
        <button type="button" onClick={() => props.onTimeout?.()}>
          timeout
        </button>
      </div>
    );
  }),
}));

describe('TurnstileField', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockReset.mockReset();
    mockPropsSpy.mockReset();
    applyTheme('light');
  });

  it('sin clave de sitio entrega el token de prueba, no pinta el widget y reemite al reiniciar', () => {
    const onToken = vi.fn();
    const { rerender } = render(<TurnstileField onToken={onToken} resetSignal={0} />);

    expect(onToken).toHaveBeenCalledWith(TURNSTILE_DUMMY_TOKEN);
    expect(screen.getByTestId('turnstile-widget')).not.toBeVisible();

    rerender(<TurnstileField onToken={onToken} resetSignal={1} />);
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenLastCalledWith(TURNSTILE_DUMMY_TOKEN);
  });

  it('con clave configurada sigue el tema reactivo y reinicia el widget al cambiar resetSignal', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    applyTheme('dark');

    const onToken = vi.fn();
    const { rerender } = render(
      <TurnstileField onToken={onToken} resetSignal={0} action="login" />,
    );

    const widget = screen.getByTestId('mock-cf-turnstile');
    expect(widget).toHaveAttribute('data-sitekey', '1x00000000000000000000AA');
    expect(widget).toHaveAttribute('data-theme', 'dark');
    expect(widget).toHaveAttribute('data-language', 'es');

    act(() => {
      screen.getByText('solve').click();
    });
    expect(onToken).toHaveBeenCalledWith('live-cf-token');

    act(() => {
      applyTheme('light');
    });
    await waitFor(() =>
      expect(screen.getByTestId('mock-cf-turnstile')).toHaveAttribute('data-theme', 'light'),
    );

    act(() => {
      screen.getByText('timeout').click();
    });
    expect(onToken).toHaveBeenLastCalledWith('');

    rerender(<TurnstileField onToken={onToken} resetSignal={1} action="login" />);
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenLastCalledWith('');
  });
});
