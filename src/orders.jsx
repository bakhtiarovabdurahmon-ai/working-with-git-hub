// Заказы: покупатель оформляет -> продавец подтверждает наличие -> покупатель
// переводит деньги -> супер админ подтверждает перевод -> заказ выдан.
//
// Если backend доступен — заказы общие для всех (MongoDB, см. server/routes/orders.js).
// Если нет — откатываемся на localStorage, как и другие данные в этом демо.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, checkServer } from './api.js';
import { useAuth } from './auth.jsx';

const ORDERS_KEY = 'wb_clone_orders';

function readOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function writeOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function genOrderNumber() {
  return 'OP-' + Math.floor(100000 + Math.random() * 900000);
}

// Локальный режим хранит аккаунты в том же ключе, что и auth.jsx —
// начисляем кешбек прямо туда, чтобы баланс не расходился между модулями.
const USERS_KEY = 'wb_clone_users';

function creditLocalCashback(buyerEmail, amount) {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || {};
    const user = users[buyerEmail];
    if (!user) return;
    users[buyerEmail] = { ...user, cashback: (user.cashback || 0) + amount };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    // ignore
  }
}

function isStaffRole(role) {
  return role === 'admin' || role === 'superadmin';
}

const OrdersContext = createContext(null);

export function OrdersProvider({ children }) {
  const { currentUser } = useAuth();
  const [myOrders, setMyOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [serverMode, setServerMode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    checkServer().then((ok) => {
      if (!cancelled) setServerMode(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!currentUser) {
      setMyOrders([]);
      setSellerOrders([]);
      return;
    }
    if (serverMode) {
      const data = await api.getMyOrders();
      setMyOrders(data.asBuyer || []);
      setSellerOrders(data.asSeller || []);
      return;
    }
    const local = readOrders();
    setMyOrders(local.filter((o) => o.buyerEmail === currentUser.email));
    if (isStaffRole(currentUser.role)) {
      setSellerOrders(local);
    } else if (currentUser.role === 'seller' && currentUser.shopId) {
      setSellerOrders(local.filter((o) => o.shopId === currentUser.shopId));
    } else if (currentUser.role === 'seller') {
      setSellerOrders(local.filter((o) => o.sellerEmail === currentUser.email));
    } else {
      setSellerOrders([]);
    }
  }, [serverMode, currentUser]);

  useEffect(() => {
    if (serverMode === null) return;
    refresh().catch(() => {});
  }, [serverMode, currentUser, refresh]);

  // Заказы общие для всех устройств (один купил с другого телефона, продавец
  // подтвердил с другого) — опрашиваем сервер сами, чтобы список обновлялся
  // без ручного обновления страницы.
  useEffect(() => {
    if (!serverMode || !currentUser) return;
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 8000);
    return () => clearInterval(timer);
  }, [serverMode, currentUser, refresh]);

  const createOrders = useCallback(
    async (items, fulfillment) => {
      if (!currentUser) throw new Error('Нужен вход, чтобы оформить заказ');

      if (serverMode) {
        const created = await api.createOrders(items, fulfillment);
        await refresh();
        return created;
      }

      const groups = new Map();
      items.forEach((it) => {
        const key = it.shopId || it.sellerEmail || '__store__';
        if (!groups.has(key)) groups.set(key, { shopId: it.shopId || null, sellerEmail: it.sellerEmail || null, items: [] });
        groups.get(key).items.push({ productId: it.productId, title: it.title, price: it.price, qty: it.qty });
      });

      const now = new Date().toISOString();
      const created = [...groups.values()].map((group) => ({
        id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        orderNumber: genOrderNumber(),
        buyerEmail: currentUser.email,
        buyerName: currentUser.name,
        sellerEmail: group.sellerEmail,
        shopId: group.shopId,
        items: group.items,
        total: group.items.reduce((sum, it) => sum + it.price * it.qty, 0),
        fulfillment,
        status: 'pending_stock',
        receiptFileName: null,
        createdAt: now,
        updatedAt: now,
      }));

      const next = [...readOrders(), ...created];
      writeOrders(next);
      await refresh();
      return created;
    },
    [serverMode, currentUser, refresh]
  );

  const confirmStock = useCallback(
    async (id, inStock, cashback) => {
      if (serverMode) {
        await api.confirmStock(id, inStock, cashback);
        await refresh();
        return;
      }
      const orders = readOrders();
      const order = orders.find((o) => o.id === id);
      const cashbackNum = Number(cashback) || 0;
      const next = orders.map((o) =>
        o.id === id
          ? {
              ...o,
              status: inStock ? 'awaiting_payment' : 'out_of_stock',
              cashbackAwarded: inStock && cashbackNum > 0 ? cashbackNum : o.cashbackAwarded || 0,
              updatedAt: new Date().toISOString(),
            }
          : o
      );
      writeOrders(next);
      if (inStock && cashbackNum > 0 && order) {
        creditLocalCashback(order.buyerEmail, cashbackNum);
      }
      await refresh();
    },
    [serverMode, refresh]
  );

  const markPaid = useCallback(
    async (id, receiptFileName, receiptImage) => {
      if (serverMode) {
        await api.markOrderPaid(id, receiptFileName, receiptImage);
        await refresh();
        return;
      }
      const next = readOrders().map((o) =>
        o.id === id
          ? { ...o, status: 'payment_review', receiptFileName, receiptImage, updatedAt: new Date().toISOString() }
          : o
      );
      writeOrders(next);
      await refresh();
    },
    [serverMode, refresh]
  );

  const confirmPayment = useCallback(
    async (id) => {
      if (serverMode) {
        await api.confirmOrderPayment(id);
        await refresh();
        return;
      }
      const next = readOrders().map((o) => (o.id === id ? { ...o, status: 'completed', updatedAt: new Date().toISOString() } : o));
      writeOrders(next);
      await refresh();
    },
    [serverMode, refresh]
  );

  const value = { myOrders, sellerOrders, createOrders, confirmStock, markPaid, confirmPayment, refresh, serverMode };

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider');
  return ctx;
}
