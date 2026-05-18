const BASE_URL = import.meta.env.VITE_API_BASE || '/api/guest';

export class GuestApiError extends Error {
  status: number;
  code: string;
  meta?: unknown;

  constructor(status: number, code: string, message: string, meta?: unknown) {
    super(message);
    this.name = 'GuestApiError';
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

export async function guestFetch<T>(
  path: string,
  options: RequestInit = {},
  token: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Room-Token', token);
  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const code = typeof body.error === 'string' ? body.error : 'UNKNOWN';
    throw new GuestApiError(response.status, code, code || response.statusText, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
