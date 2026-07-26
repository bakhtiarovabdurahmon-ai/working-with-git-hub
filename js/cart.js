// Общая логика корзины и избранного (localStorage), используется на всех страницах

const CART_KEY = 'wb_clone_cart';
const FAV_KEY = 'wb_clone_favorites';

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch (e) {
    return {};
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCart() {
  return readStore(CART_KEY);
}

function getCartCount() {
  const cart = getCart();
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

function addToCart(productId, qty = 1) {
  const cart = getCart();
  cart[productId] = (cart[productId] || 0) + qty;
  writeStore(CART_KEY, cart);
  updateHeaderCounters();
}

function setCartQty(productId, qty) {
  const cart = getCart();
  if (qty <= 0) {
    delete cart[productId];
  } else {
    cart[productId] = qty;
  }
  writeStore(CART_KEY, cart);
  updateHeaderCounters();
}

function removeFromCart(productId) {
  const cart = getCart();
  delete cart[productId];
  writeStore(CART_KEY, cart);
  updateHeaderCounters();
}

function getFavorites() {
  return readStore(FAV_KEY);
}

function isFavorite(productId) {
  return !!getFavorites()[productId];
}

function toggleFavorite(productId) {
  const favs = getFavorites();
  if (favs[productId]) {
    delete favs[productId];
  } else {
    favs[productId] = true;
  }
  writeStore(FAV_KEY, favs);
  updateHeaderCounters();
  return !!favs[productId];
}

function getFavoritesCount() {
  return Object.keys(getFavorites()).length;
}

function formatPrice(value) {
  return value.toLocaleString('ru-RU') + ' ₽';
}

function updateHeaderCounters() {
  const cartBadge = document.querySelector('[data-cart-count]');
  const favBadge = document.querySelector('[data-fav-count]');
  const cartCount = getCartCount();
  const favCount = getFavoritesCount();
  if (cartBadge) {
    cartBadge.textContent = cartCount;
    cartBadge.style.display = cartCount > 0 ? 'flex' : 'none';
  }
  if (favBadge) {
    favBadge.textContent = favCount;
    favBadge.style.display = favCount > 0 ? 'flex' : 'none';
  }
}

document.addEventListener('DOMContentLoaded', updateHeaderCounters);
