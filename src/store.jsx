// Корзина, избранное и товары, добавленные продавцами: состояние в React
// Context, синхронизация с localStorage. Товары, добавленные продавцом,
// хранятся только в браузере этого продавца/администратора — сайт статический,
// без общего сервера и базы данных, поэтому другие посетители их не увидят.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PRODUCTS } from './data.js';

const CART_KEY = 'wb_clone_cart';
const FAV_KEY = 'wb_clone_favorites';
const CUSTOM_PRODUCTS_KEY = 'wb_clone_custom_products';

function readStore(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function formatPrice(value) {
  return value.toLocaleString('ru-RU') + ' сом';
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => readStore(CART_KEY));
  const [favorites, setFavorites] = useState(() => readStore(FAV_KEY));
  const [customProducts, setCustomProducts] = useState(() => readStore(CUSTOM_PRODUCTS_KEY, []));

  useEffect(() => writeStore(CART_KEY, cart), [cart]);
  useEffect(() => writeStore(FAV_KEY, favorites), [favorites]);
  useEffect(() => writeStore(CUSTOM_PRODUCTS_KEY, customProducts), [customProducts]);

  const addProduct = useCallback((product) => {
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const withId = { ...product, id };
    setCustomProducts((prev) => [withId, ...prev]);
    return withId;
  }, []);

  const removeProduct = useCallback((id) => {
    setCustomProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const allProducts = useMemo(() => [...customProducts, ...PRODUCTS], [customProducts]);

  const getProduct = useCallback((id) => allProducts.find((p) => p.id === id), [allProducts]);

  const addToCart = useCallback((productId, qty = 1) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + qty }));
  }, []);

  const setCartQty = useCallback((productId, qty) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  const toggleFavorite = useCallback(
    (productId) => {
      const next = { ...favorites };
      let active;
      if (next[productId]) {
        delete next[productId];
        active = false;
      } else {
        next[productId] = true;
        active = true;
      }
      setFavorites(next);
      return active;
    },
    [favorites]
  );

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const favoritesCount = Object.keys(favorites).length;

  const value = {
    cart,
    favorites,
    cartCount,
    favoritesCount,
    addToCart,
    setCartQty,
    removeFromCart,
    clearCart,
    toggleFavorite,
    isFavorite: (id) => !!favorites[id],
    customProducts,
    allProducts,
    addProduct,
    removeProduct,
    getProduct,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
