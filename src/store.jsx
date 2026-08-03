// Корзина и избранное: состояние в React Context, синхронизация с localStorage

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

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

export function formatPrice(value) {
  return value.toLocaleString('ru-RU') + ' ₽';
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => readStore(CART_KEY));
  const [favorites, setFavorites] = useState(() => readStore(FAV_KEY));

  useEffect(() => writeStore(CART_KEY, cart), [cart]);
  useEffect(() => writeStore(FAV_KEY, favorites), [favorites]);

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
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
