// Тонкий клиент для backend API (Express + MongoDB, см. server/).
// Если сервер недоступен — например, у опубликованной статической
// ссылки-артефакта нет бэкенда — приложение сама автоматически
// переключается в локальный режим (localStorage), см. auth.jsx и store.jsx.

// Относительный путь: в dev-режиме Vite сам проксирует /api на сервер
// (см. vite.config.js), а в проде сервер отдаёт и API, и сам сайт с одного
// адреса — так что localhost прописывать нигде не нужно.
const API_URL = import.meta.env.VITE_API_URL || '/api';

let availabilityPromise = null;

export function checkServer() {
  if (!availabilityPromise) {
    availabilityPromise = fetch(API_URL + '/health', { method: 'GET' })
      .then((r) => r.ok)
      .catch(() => false);
  }
  return availabilityPromise;
}

// Session token from /auth/verify-code, attached to every request so the
// backend can authorize role/product changes — see server/middleware/auth.js.
let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = 'Bearer ' + authToken;
  const res = await fetch(API_URL + path, {
    headers,
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
  me: () => request('/auth/me'),
  getUsers: () => request('/users'),
  setUserRole: (email, role) =>
    request(`/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  promoteByCode: (code) => request('/users/promote-by-code', { method: 'POST', body: JSON.stringify({ code }) }),
  getProducts: () => request('/products'),
  createProduct: (product) => request('/products', { method: 'POST', body: JSON.stringify(product) }),
  deleteProduct: (id) => request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createOrders: (items, fulfillment) => request('/orders', { method: 'POST', body: JSON.stringify({ items, fulfillment }) }),
  getMyOrders: () => request('/orders/mine'),
  confirmStock: (id, inStock) => request(`/orders/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ inStock }) }),
  markOrderPaid: (id, receiptFileName) => request(`/orders/${id}/receipt`, { method: 'PATCH', body: JSON.stringify({ receiptFileName }) }),
  confirmOrderPayment: (id) => request(`/orders/${id}/confirm-payment`, { method: 'PATCH' }),
  getShops: () => request('/shops'),
  createShop: (name) => request('/shops', { method: 'POST', body: JSON.stringify({ name }) }),
  assignToShop: (userCode, shopCode) => request('/shops/assign', { method: 'POST', body: JSON.stringify({ userCode, shopCode }) }),
};
