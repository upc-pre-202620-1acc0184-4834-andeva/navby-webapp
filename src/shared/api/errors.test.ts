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

  it('parsea códigos reales de Turnstile (400 CAPTCHA_INVALID, 503 PROVIDER_UNAVAILABLE) y códigos futuros desconocidos', async () => {
    const captchaResponse = new Response(
      JSON.stringify({
        title: 'Verificación de seguridad inválida',
        status: 400,
        detail: 'La verificación de seguridad no es válida.',
        code: 'CAPTCHA_INVALID',
      }),
      { status: 400, headers: { 'content-type': 'application/problem+json' } },
    );

    const captchaErr = await parseApiError(captchaResponse);
    expect(captchaErr.code).toBe('CAPTCHA_INVALID');
    expect(captchaErr.status).toBe(400);

    const providerResponse = new Response(
      JSON.stringify({
        title: 'Proveedor no disponible',
        status: 503,
        detail: 'No se pudo comprobar la verificación de seguridad.',
        code: 'PROVIDER_UNAVAILABLE',
      }),
      { status: 503, headers: { 'content-type': 'application/problem+json' } },
    );

    const providerErr = await parseApiError(providerResponse);
    expect(providerErr.code).toBe('PROVIDER_UNAVAILABLE');
    expect(providerErr.status).toBe(503);

    const futureResponse = new Response(
      JSON.stringify({
        title: 'Nuevo error',
        status: 418,
        detail: 'Extensible',
        code: 'SOME_FUTURE_CODE',
      }),
      { status: 418, headers: { 'content-type': 'application/problem+json' } },
    );

    const futureErr = await parseApiError(futureResponse);
    expect(futureErr.code).toBe('SOME_FUTURE_CODE');
    expect(futureErr.status).toBe(418);
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
