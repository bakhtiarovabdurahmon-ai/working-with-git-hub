// Корзина и избранное — всегда локально (localStorage), это личные данные
// браузера, а не общий каталог. Товары (общие карточки) и сток продавцов —
// через backend API (server/, MongoDB), если он доступен; если нет — тоже
// откатываются на localStorage (и тогда видны только в этом браузере,
// без нескольких магазинов на одной карточке — это только для сервера).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PRODUCTS } from './data.js';
import { api, checkServer } from './api.js';
import { useAuth } from './auth.jsx';

const CART_KEY = 'wb_clone_cart';
const FAV_KEY = 'wb_clone_favorites';
const CUSTOM_PRODUCTS_KEY = 'wb_clone_custom_products';
const REVIEWS_KEY = 'wb_clone_reviews';

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

// Есть ли хоть у одного магазина этот размер в наличии — sizeStock приходит
// с сервера (сумма по всем магазинам, см. server/routes/products.js). В
// офлайн-режиме такой агрегации нет, тогда ориентируемся на общий inStock.
export function sizeHasStock(product, size) {
  if (!product) return false;
  if (product.sizeStock) return (product.sizeStock[size] || 0) > 0;
  return product.inStock !== false;
}

function cartKey(productId, size) {
  return `${productId}::${size}`;
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const { isSeller, currentUser } = useAuth();
  const [cart, setCart] = useState(() => readStore(CART_KEY));
  const [favorites, setFavorites] = useState(() => readStore(FAV_KEY));
  const [customProducts, setCustomProducts] = useState([]);
  const [myStock, setMyStock] = useState([]);
  const [serverMode, setServerMode] = useState(null); // null = ещё проверяем

  useEffect(() => writeStore(CART_KEY, cart), [cart]);
  useEffect(() => writeStore(FAV_KEY, favorites), [favorites]);

  const loadProducts = useCallback(async () => {
    if (serverMode) {
      try {
        setCustomProducts(await api.getProducts());
      } catch (e) {
        // ignore — keep whatever list we already had
      }
    }
  }, [serverMode]);

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

  const loadMyStock = useCallback(async () => {
    if (!serverMode || !isSeller) {
      setMyStock([]);
      return;
    }
    try {
      setMyStock(await api.getMyStock());
    } catch (e) {
      setMyStock([]);
    }
  }, [serverMode, isSeller]);

  useEffect(() => {
    loadMyStock();
  }, [loadMyStock]);

  // Создать новую общую карточку + первую стоковую строку (я — первый
  // магазин, кто её продаёт). sizes: [{ size, qty }].
  const addProduct = useCallback(
    async (product) => {
      if (serverMode) {
        const created = await api.createProduct(product);
        setCustomProducts((prev) => [created, ...prev]);
        await loadMyStock();
        return created;
      }
      const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const withId = { ...product, id, sizes: (product.sizes || []).map((s) => s.size || s) };
      setCustomProducts((prev) => [withId, ...prev]);
      return withId;
    },
    [serverMode, loadMyStock]
  );

  // Присоединить свой сток к уже существующей карточке (другой магазин уже
  // продаёт то же самое) — карточка остаётся одна.
  const joinStock = useCallback(
    async (productId, sizes) => {
      if (!serverMode) throw new Error('Присоединение к чужому товару доступно только на сервере');
      await api.joinProductStock(productId, sizes);
      await Promise.all([loadProducts(), loadMyStock()]);
    },
    [serverMode, loadProducts, loadMyStock]
  );

  const updateMyStock = useCallback(
    async (stockId, sizes) => {
      if (serverMode) {
        await api.updateStock(stockId, sizes);
        await Promise.all([loadProducts(), loadMyStock()]);
      }
    },
    [serverMode, loadProducts, loadMyStock]
  );

  // Убрать свой сток с карточки (карточка остаётся, если её продают и
  // другие магазины) — в офлайн-режиме своя карточка одна на весь товар,
  // поэтому там это по-прежнему удаляет саму карточку.
  const removeMyStock = useCallback(
    async (stockId) => {
      if (serverMode) {
        await api.deleteStock(stockId);
        await Promise.all([loadProducts(), loadMyStock()]);
      } else {
        setCustomProducts((prev) => prev.filter((p) => p.id !== stockId));
      }
    },
    [serverMode, loadProducts, loadMyStock]
  );

  // Полностью удалить карточку товара (вместе со стоком всех магазинов) —
  // в отличие от removeMyStock выше, это может любой продавец/админ, не
  // только владелец стока.
  const deleteProduct = useCallback(
    async (productId) => {
      if (serverMode) {
        await api.deleteProduct(productId);
        await Promise.all([loadProducts(), loadMyStock()]);
      } else {
        setCustomProducts((prev) => prev.filter((p) => p.id !== productId));
      }
    },
    [serverMode, loadProducts, loadMyStock]
  );

  // Разовая продажа "вживую" по одному размеру своего стока — на 1 штуку за
  // клик. Когда сток по карточке кончается, сервер сам прячет её из
  // каталога (см. server/lib/archive.js), поэтому здесь достаточно
  // перезагрузить списки.
  const sellSize = useCallback(
    async (stockId, size) => {
      if (!serverMode) throw new Error('Быстрая продажа доступна только на сервере');
      await api.sellSize(stockId, size);
      await Promise.all([loadProducts(), loadMyStock()]);
    },
    [serverMode, loadProducts, loadMyStock]
  );

  const getReviews = useCallback(
    async (productId) => {
      if (serverMode) return api.getProductReviews(productId);
      const map = readStore(REVIEWS_KEY, {});
      return (map[productId] || []).slice().reverse();
    },
    [serverMode]
  );

  const addReview = useCallback(
    async (productId, rating, text) => {
      if (serverMode) {
        const created = await api.addProductReview(productId, rating, text);
        await loadProducts();
        return created;
      }
      const map = readStore(REVIEWS_KEY, {});
      const list = map[productId] || [];
      const review = {
        id: 'rv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        authorName: currentUser?.name || currentUser?.email || 'Гость',
        rating,
        text,
        createdAt: new Date().toISOString(),
      };
      map[productId] = [...list, review];
      writeStore(REVIEWS_KEY, map);
      return review;
    },
    [serverMode, currentUser, loadProducts]
  );

  const allProducts = useMemo(() => [...customProducts, ...PRODUCTS], [customProducts]);

  const getProduct = useCallback((id) => allProducts.find((p) => p.id === id), [allProducts]);

  const myStockForProduct = useCallback((productId) => myStock.find((s) => s.productId === productId), [myStock]);

  const addToCart = useCallback(
    (productId, size, qty = 1) => {
      const product = allProducts.find((p) => p.id === productId);
      if (product && !isOrderable(product, serverMode)) return;
      if (product && !sizeHasStock(product, size)) return;
      const key = cartKey(productId, size);
      setCart((prev) => ({
        ...prev,
        [key]: { productId, size, qty: (prev[key]?.qty || 0) + qty },
      }));
    },
    [allProducts, serverMode]
  );

  const setCartQty = useCallback((key, qty) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[key];
      } else if (next[key]) {
        next[key] = { ...next[key], qty };
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((key) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[key];
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

  const cartCount = Object.values(cart).reduce((sum, line) => sum + line.qty, 0);
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
    joinStock,
    updateMyStock,
    removeMyStock,
    deleteProduct,
    sellSize,
    getReviews,
    addReview,
    myStock,
    myStockForProduct,
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
