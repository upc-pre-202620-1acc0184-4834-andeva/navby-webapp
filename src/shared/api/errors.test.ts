import { describe, expect, it } from 'vitest';
import { ApiError, isApiError, parseApiError } from './errors';

describe('ApiError & parseApiError', () => {
  it('parsea errores RFC 7807 incluyendo campos nullish', async () => {
    const response = new Response(
      JSON.stringify({
        type: null,
        title: 'Error de validación',
        status: 422,
        detail: 'Los parámetros enviados no son válidos.',
        instance: null,
        code: 'VALIDATION_ERROR',
        invalid_params: [{ name: 'email', reason: 'invalid' }],
      }),
      { status: 422, headers: { 'content-type': 'application/problem+json' } },
    );

    const err = await parseApiError(response);
    expect(isApiError(err)).toBe(true);
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.type).toBeUndefined();
    expect(err.instance).toBeUndefined();
    expect(err.invalidParams).toEqual([{ name: 'email', reason: 'invalid' }]);
  });

  it('tolera códigos de error futuros como CAPTCHA_INVALID sin fallar el parseo', async () => {
    const response = new Response(
      JSON.stringify({
        title: 'Captcha inválido',
        status: 403,
        detail: 'Verifica que no eres un robot.',
        code: 'CAPTCHA_INVALID',
      }),
      { status: 403, headers: { 'content-type': 'application/problem+json' } },
    );

    const err = await parseApiError(response);
    expect(err.code).toBe('CAPTCHA_INVALID');
    expect(err.status).toBe(403);
  });

  it('genera ApiError de respaldo cuando el proxy devuelve HTML o JSON inválido', async () => {
    const htmlResponse = new Response('<html>502 Bad Gateway</html>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'text/html' },
    });

    const htmlErr = await parseApiError(htmlResponse);
    expect(htmlErr).toBeInstanceOf(ApiError);
    expect(htmlErr.code).toBe('HTTP_502');
    expect(htmlErr.status).toBe(502);

    const brokenJsonResponse = new Response('{broken', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
    });
    const brokenErr = await parseApiError(brokenJsonResponse);
    expect(brokenErr.code).toBe('HTTP_500');
  });
});
