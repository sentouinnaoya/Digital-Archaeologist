import type { AuthResponse } from './types';

export const AUTH_STORAGE_KEY = 'digital-archaeologist-auth';

export function readStoredAuth(): AuthResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthResponse;
    if (!parsed.accessToken || !parsed.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredAuth(value: AuthResponse | null): void {
  if (typeof window === 'undefined') return;
  if (value) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}
