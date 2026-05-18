const BASE_URL = import.meta.env.VITE_API_BASE || '/api';

export class CounterApiError extends Error {
  status: number;
  code: string;
  meta?: unknown;

  constructor(status: number, code: string, message: string, meta?: unknown) {
    super(message);
    this.name = 'CounterApiError';
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new CounterApiError(0, 'NETWORK', 'Cannot reach the server.');
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const code = typeof body.error === 'string' ? body.error : 'UNKNOWN';
    throw new CounterApiError(res.status, code, code || res.statusText, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
