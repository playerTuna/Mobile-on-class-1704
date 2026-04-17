export const STORAGE_KEYS = {
  apiBase: 'taskapp_api_base',
  token: 'taskapp_access_token',
};

export function getApiBase() {
  const storedApiBase = localStorage.getItem(STORAGE_KEYS.apiBase);
  if (storedApiBase) {
    return storedApiBase.replace(/\/+$/, '');
  }

  const envApiBase = import.meta.env.VITE_API_URL?.trim();
  if (envApiBase) {
    return envApiBase.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

export function setApiBase(value) {
  localStorage.setItem(STORAGE_KEYS.apiBase, value.replace(/\/+$/, ''));
}

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token) || '';
}

export function setToken(value) {
  localStorage.setItem(STORAGE_KEYS.token, value);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEYS.token);
}
