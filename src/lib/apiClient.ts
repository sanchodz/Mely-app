import { tokenStore } from './tokenStore';

const CONFIGURED_API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

/**
 * En la web desplegada en Vercel (*.vercel.app) la API se llama por el mismo dominio:
 * vercel.json reescribe /api/v1/* hacia el backend. Así el navegador no hace chequeo de
 * CORS y la web sigue andando aunque el backend no tenga este dominio en FRONTEND_ORIGIN.
 * La app nativa (Capacitor sirve desde localhost) y el dev local siguen usando VITE_API_URL.
 */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')) {
    return window.location.origin;
  }
  return CONFIGURED_API_URL;
}

export const API_BASE_URL: string = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Si es FormData, no se serializa ni se le pone Content-Type (el browser arma el boundary). */
  formData?: FormData;
  /** Rutas de auth (login/register/refresh) no deben reintentar con refresh en un 401. */
  skipAuthRetry?: boolean;
};

let refreshingPromise: Promise<void> | null = null;

async function rawRequest<T>(path: string, opts: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const token = tokenStore.getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body,
  });

  if (res.status === 204) return null as T;

  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    // res.statusText suele venir vacío con fetch — sin fallback los toasts quedaban sin texto.
    const message = err?.message || (res.statusText ? `Error ${res.status}: ${res.statusText}` : `Error ${res.status}`);
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', message, err?.details);
  }

  return data as T;
}

async function refreshSession(): Promise<void> {
  if (!refreshingPromise) {
    refreshingPromise = doRefresh().finally(() => {
      refreshingPromise = null;
    });
  }
  return refreshingPromise;
}

async function doRefresh(): Promise<void> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) throw new ApiError(401, 'NO_SESSION', 'Sin sesión activa');
  try {
    const data = await rawRequest<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuthRetry: true,
    });
    tokenStore.setTokens(data.accessToken, data.refreshToken);
  } catch (err) {
    tokenStore.clear();
    throw err;
  }
}

/** Request autenticado con un reintento automático tras refrescar el token en un 401. */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !opts.skipAuthRetry) {
      await refreshSession();
      return rawRequest<T>(path, opts);
    }
    throw err;
  }
}
