import { request, authHeaders } from './http';

export function getTasks(apiBase, token) {
  return request(apiBase, '/v1/tasks', {
    headers: authHeaders(token),
  });
}

export function createTask(apiBase, token, payload) {
  return request(apiBase, '/v1/tasks', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function removeTask(apiBase, token, id) {
  return request(apiBase, `/v1/tasks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}
