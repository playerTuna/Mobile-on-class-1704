import { request, authHeaders } from './http';

export function register(apiBase, payload) {
  return request(apiBase, '/v1/auth/register', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export function login(apiBase, payload) {
  return request(apiBase, '/v1/auth/login', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export function getProfile(apiBase, token) {
  return request(apiBase, '/v1/auth/profile', {
    headers: authHeaders(token),
  });
}
