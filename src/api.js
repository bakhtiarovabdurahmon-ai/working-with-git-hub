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
  requestCode: (email, name, company) =>
    request('/auth/request-code', { method: 'POST', body: JSON.stringify({ email, name, company }) }),
  verifyCode: (email, code) => request('/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getUsers: () => request('/users'),
  setUserRole: (email, role) =>
    request(`/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  promoteByCode: (code) => request('/users/promote-by-code', { method: 'POST', body: JSON.stringify({ code }) }),
  getProducts: () => request('/products'),
  searchProducts: (q) => request(`/products/search?q=${encodeURIComponent(q)}`),
  createProduct: (product) => request('/products', { method: 'POST', body: JSON.stringify(product) }),
  joinProductStock: (productId, sizes) =>
    request(`/products/${encodeURIComponent(productId)}/stock`, { method: 'POST', body: JSON.stringify({ sizes }) }),
  getMyStock: () => request('/products/stock/mine'),
  getAllStock: () => request('/products/stock'),
  updateStock: (stockId, sizes) =>
    request(`/products/stock/${encodeURIComponent(stockId)}`, { method: 'PATCH', body: JSON.stringify({ sizes }) }),
  deleteStock: (stockId) => request(`/products/stock/${encodeURIComponent(stockId)}`, { method: 'DELETE' }),
  deleteProduct: (id) => request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  sellSize: (stockId, size) =>
    request(`/products/stock/${encodeURIComponent(stockId)}/sell`, { method: 'PATCH', body: JSON.stringify({ size }) }),
  getProductReviews: (id) => request(`/products/${encodeURIComponent(id)}/reviews`),
  addProductReview: (id, rating, text) =>
    request(`/products/${encodeURIComponent(id)}/reviews`, { method: 'POST', body: JSON.stringify({ rating, text }) }),
  setShift: (onShift) => request('/users/me/shift', { method: 'PATCH', body: JSON.stringify({ onShift }) }),
  getDailyReport: (date) => request(`/orders/report${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  createOrders: (items, fulfillment, address) =>
    request('/orders', { method: 'POST', body: JSON.stringify({ items, fulfillment, address }) }),
  getMyOrders: () => request('/orders/mine'),
  confirmStock: (id, inStock) => request(`/orders/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ inStock }) }),
  markOrderPaid: (id, receiptFileName, receiptImage) =>
    request(`/orders/${id}/receipt`, { method: 'PATCH', body: JSON.stringify({ receiptFileName, receiptImage }) }),
  confirmOrderPayment: (id) => request(`/orders/${id}/confirm-payment`, { method: 'PATCH' }),
  shipOrder: (id, image, note) => request(`/orders/${id}/ship`, { method: 'PATCH', body: JSON.stringify({ image, note }) }),
  getShops: () => request('/shops'),
  createShop: (name) => request('/shops', { method: 'POST', body: JSON.stringify({ name }) }),
  assignToShop: (userCode, shopCode) => request('/shops/assign', { method: 'POST', body: JSON.stringify({ userCode, shopCode }) }),
};
