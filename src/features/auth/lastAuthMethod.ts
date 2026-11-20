const STORAGE_KEY = 'navby-last-auth-method';

export type AuthMethod = 'google' | 'password';

export function getLastAuthMethod(): AuthMethod | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'google' || value === 'password' ? value : null;
  } catch {
    return null;
  }
}

export function setLastAuthMethod(method: AuthMethod): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // Almacenamiento bloqueado o no disponible: se ignora sin afectar el acceso.
  }
}
