// Attach the panel session (telegramId:sessionId) as a Bearer token on API calls.
const AUTH_KEY = 'cyberzone_auth';

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.telegramId && parsed.sessionId) {
        headers['Authorization'] = `Bearer ${parsed.telegramId}:${parsed.sessionId}`;
      }
    }
  } catch {
    /* ignore malformed auth */
  }
  return headers;
}

export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: authHeaders(init.headers as Record<string, string> | undefined) });
}
