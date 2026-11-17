import { z } from 'zod';

export const InvalidParamSchema = z.object({
  name: z.string(),
  reason: z.string(),
});

export type InvalidParam = z.infer<typeof InvalidParamSchema>;

export const ProblemDetailsSchema = z.object({
  type: z.string().nullish(),
  title: z.string(),
  status: z.number(),
  detail: z.string(),
  instance: z.string().nullish(),
  code: z.string(),
  invalid_params: z.array(InvalidParamSchema).nullish(),
});

export interface ApiErrorInit {
  status: number;
  code: string;
  title: string;
  detail: string;
  type?: string;
  instance?: string;
  invalidParams?: ReadonlyArray<InvalidParam>;
  cause?: unknown;
}

/** Error HTTP tipado a partir de RFC 7807 (`application/problem+json`) o fallos de red/respuesta. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly type?: string;
  readonly instance?: string;
  readonly invalidParams?: ReadonlyArray<InvalidParam>;

  constructor(init: ApiErrorInit) {
    super(init.detail || init.title, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.type = init.type;
    this.instance = init.instance;
    this.invalidParams = init.invalidParams;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function parseApiError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      const raw = await response.text();
      if (raw.trim().length > 0) {
        const parsed = ProblemDetailsSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          const { data } = parsed;
          return new ApiError({
            status: data.status,
            code: data.code,
            title: data.title,
            detail: data.detail,
            type: data.type ?? undefined,
            instance: data.instance ?? undefined,
            invalidParams: data.invalid_params ?? undefined,
          });
        }
      }
    } catch {
      // Cuerpos malformados caen al error HTTP de respaldo.
    }
  }

  return new ApiError({
    status: response.status,
    code: `HTTP_${response.status}`,
    title: response.statusText || 'HTTP Error',
    detail: response.statusText || `HTTP ${response.status}`,
  });
}
