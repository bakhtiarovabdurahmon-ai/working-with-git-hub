// Корзина и избранное — всегда локально (localStorage), это личные данные
// браузера, а не общий каталог. Товары, добавленные продавцами, идут через
// backend API (server/, MongoDB), если он доступен; если нет — тоже
// откатываются на localStorage (и тогда видны только в этом браузере).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PRODUCTS } from './data.js';
import { api, checkServer } from './api.js';

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

// Витринные товары (см. data.js) не привязаны ни к одному продавцу — их
// некому подтвердить и отдать, поэтому оформить заказ на них по-настоящему
// нельзя, как только подключён реальный backend. В офлайн-режиме (нет
// сервера) все заказы и так идут только локально, ограничение не нужно.
export function isOrderable(product, serverMode) {
  return !(serverMode && product.isDemo);
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => readStore(CART_KEY));
  const [favorites, setFavorites] = useState(() => readStore(FAV_KEY));
  const [customProducts, setCustomProducts] = useState([]);
  const [serverMode, setServerMode] = useState(null); // null = ещё проверяем

  useEffect(() => writeStore(CART_KEY, cart), [cart]);
  useEffect(() => writeStore(FAV_KEY, favorites), [favorites]);

  useEffect(() => {
    let cancelled = false;
    checkServer().then(async (ok) => {
      if (cancelled) return;
      setServerMode(ok);
      if (ok) {
        try {
          const list = await api.getProducts();
          if (!cancelled) setCustomProducts(list);
        } catch (e) {
          if (!cancelled) setCustomProducts(readStore(CUSTOM_PRODUCTS_KEY, []));
        }
      } else {
        setCustomProducts(readStore(CUSTOM_PRODUCTS_KEY, []));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (serverMode === false) writeStore(CUSTOM_PRODUCTS_KEY, customProducts);
  }, [customProducts, serverMode]);

  const addProduct = useCallback(
    async (product) => {
      if (serverMode) {
        const created = await api.createProduct(product);
        setCustomProducts((prev) => [created, ...prev]);
        return created;
      }
      const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const withId = { ...product, id };
      setCustomProducts((prev) => [withId, ...prev]);
      return withId;
    },
    [serverMode]
  );

  const removeProduct = useCallback(
    async (id) => {
      if (serverMode) {
        await api.deleteProduct(id);
      }
      setCustomProducts((prev) => prev.filter((p) => p.id !== id));
    },
    [serverMode]
  );

  const allProducts = useMemo(() => [...customProducts, ...PRODUCTS], [customProducts]);

  const getProduct = useCallback((id) => allProducts.find((p) => p.id === id), [allProducts]);

  const addToCart = useCallback(
    (productId, qty = 1) => {
      const product = allProducts.find((p) => p.id === productId);
      if (product && !isOrderable(product, serverMode)) return;
      setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + qty }));
    },
    [allProducts, serverMode]
  );

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
    serverMode,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
