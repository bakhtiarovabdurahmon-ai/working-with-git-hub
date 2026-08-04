// Тонкий клиент для backend API (Express + MongoDB, см. server/).
// Если сервер недоступен — например, у опубликованной статической
// ссылки-артефакта нет бэкенда — приложение сама автоматически
// переключается в локальный режим (localStorage), см. auth.jsx и store.jsx.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

let availabilityPromise = null;

export function checkServer() {
  if (!availabilityPromise) {
    availabilityPromise = fetch(API_URL + '/health', { method: 'GET' })
      .then((r) => r.ok)
      .catch(() => false);
  }
  return availabilityPromise;
}

async function request(path, options = {}) {
  const res = await fetch(API_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = 'Ошибка сервера (' + res.status + ')';
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch (e) {
      /* no JSON body */
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  requestCode: (email, name) => request('/auth/request-code', { method: 'POST', body: JSON.stringify({ email, name }) }),
  verifyCode: (email, code) => request('/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) }),
  getUsers: () => request('/users'),
  setUserRole: (email, role) =>
    request(`/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  getProducts: () => request('/products'),
  createProduct: (product) => request('/products', { method: 'POST', body: JSON.stringify(product) }),
  deleteProduct: (id) => request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
