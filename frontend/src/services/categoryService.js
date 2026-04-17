import { request, authHeaders } from './http';

export function getCategories(apiBase, token) {
  return request(apiBase, '/v1/categories', {
    headers: authHeaders(token),
  });
}

export function createCategory(apiBase, token, payload) {
  return request(apiBase, '/v1/categories', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function removeCategory(apiBase, token, id) {
  return request(apiBase, `/v1/categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}
