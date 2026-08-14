// Аккаунты и роли (admin/seller/customer).
//
// Если backend (server/, Express + MongoDB) доступен — вход идёт без пароля,
// по коду из письма (см. server/routes/auth.js, отправка через Resend):
// requestCode() шлёт код на email, verifyCode() подтверждает его и создаёт
// или находит аккаунт в MongoDB.
//
// Если backend недоступен (например, у опубликованной статической ссылки
// нет сервера — слать письма всё равно неоткуда) — приложение автоматически
// откатывается на локальный режим: обычная пара email+пароль, аккаунт
// хранится только в этом браузере (localStorage), без шифрования. Это
// заметно более слабый режим и годится только как демо.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, checkServer, setAuthToken } from './api.js';
import { generateCode } from './codes.js';

const USERS_KEY = 'wb_clone_users';
const SESSION_KEY = 'wb_clone_session';
const TOKEN_KEY = 'wb_clone_token';
const SHOPS_KEY = 'wb_clone_shops';

function readLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function writeLocalUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readLocalShops() {
  try {
    return JSON.parse(localStorage.getItem(SHOPS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function writeLocalShops(shops) {
  localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
}

function isStaffRole(role) {
  return role === 'admin' || role === 'superadmin';
}

export const ROLE_LABELS = {
  superadmin: 'Супер администратор',
  admin: 'Администратор',
  seller: 'Продавец',
  customer: 'Покупатель',
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [users, setUsers] = useState({});
  const [shops, setShops] = useState(() => readLocalShops());
  const [serverMode, setServerMode] = useState(null); // null = ещё проверяем
  const [sessionEmail, setSessionEmail] = useState(() => localStorage.getItem(SESSION_KEY) || null);
  const [serverUser, setServerUser] = useState(null);
  const [hasToken, setHasToken] = useState(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setAuthToken(stored);
    return !!stored;
  });

  useEffect(() => {
    let cancelled = false;
    checkServer().then(async (ok) => {
      if (cancelled) return;
      setServerMode(ok);
      if (!ok) {
        setUsers(readLocalUsers());
        return;
      }
      if (hasToken) {
        try {
          const me = await api.me();
          if (!cancelled) setServerUser(me);
        } catch (e) {
          // Stored token is invalid/expired — drop it, back to logged out.
          setAuthToken(null);
          localStorage.removeItem(TOKEN_KEY);
          if (!cancelled) setHasToken(false);
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Full account list is only needed for the admin panel — fetch it lazily,
  // once we know the current user really is staff (admin or superadmin are
  // allowed to call GET /api/users, see server/routes/users.js).
  useEffect(() => {
    if (!serverMode || !isStaffRole(serverUser?.role)) return;
    let cancelled = false;
    api
      .getUsers()
      .then((list) => {
        if (cancelled) return;
        const map = {};
        list.forEach((u) => { map[u.email] = u; });
        setUsers(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serverMode, serverUser]);

  // Список магазинов — тоже только для admin/superadmin.
  useEffect(() => {
    if (!serverMode || !isStaffRole(serverUser?.role)) return;
    let cancelled = false;
    api
      .getShops()
      .then((list) => {
        if (!cancelled) setShops(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serverMode, serverUser]);

  // Серверный режим: вход по коду из письма (без пароля).
  const requestCode = useCallback(async (name, email) => {
    const key = email.trim().toLowerCase();
    if (!key) throw new Error('Укажите email');
    await api.requestCode(key, name);
  }, []);

  const verifyCode = useCallback(async (email, code) => {
    const key = email.trim().toLowerCase();
    const { user, token, isNew } = await api.verifyCode(key, code);
    setAuthToken(token);
    localStorage.setItem(TOKEN_KEY, token);
    setHasToken(true);
    setServerUser(user);
    setUsers((prev) => ({ ...prev, [key]: user }));
    setSessionEmail(key);
    localStorage.setItem(SESSION_KEY, key);
    return { user, isNew };
  }, []);

  // Локальный режим (сервер недоступен): обычная пара email+пароль в localStorage.
  const registerLocal = useCallback(
    (name, email, password) => {
      const key = email.trim().toLowerCase();
      if (!key || !password) throw new Error('Заполните email и пароль');
      if (users[key]) throw new Error('Такой email уже зарегистрирован');
      const isFirstUser = Object.keys(users).length === 0;
      // Первый зарегистрированный — единственный супер админ, без ID-кода.
      // Всем остальным — уникальный код (без цифры 6), по которому супер
      // админ сможет назначить их администратором.
      let code = null;
      if (!isFirstUser) {
        const taken = new Set(Object.values(users).map((u) => u.code).filter(Boolean));
        do {
          code = generateCode();
        } while (taken.has(code));
      }
      const user = { name: name.trim() || key, email: key, password, role: isFirstUser ? 'superadmin' : 'customer', code, shopId: null };
      const next = { ...users, [key]: user };
      setUsers(next);
      writeLocalUsers(next);
      setSessionEmail(key);
      localStorage.setItem(SESSION_KEY, key);
      return user;
    },
    [users]
  );

  const loginLocal = useCallback(
    (email, password) => {
      const key = email.trim().toLowerCase();
      const user = users[key];
      if (!user || user.password !== password) throw new Error('Неверный email или пароль');
      setSessionEmail(key);
      localStorage.setItem(SESSION_KEY, key);
      return user;
    },
    [users]
  );

  const logout = useCallback(() => {
    // Best-effort: revoke the session server-side too, so the token can't
    // keep being used after the user has explicitly logged out.
    if (serverMode && hasToken) {
      api.logout().catch(() => {});
    }
    setSessionEmail(null);
    localStorage.removeItem(SESSION_KEY);
    setServerUser(null);
    setAuthToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setHasToken(false);
  }, [serverMode, hasToken]);

  const setRole = useCallback(
    async (email, role) => {
      const key = email.trim().toLowerCase();

      if (serverMode) {
        const updated = await api.setUserRole(key, role);
        setUsers((prev) => ({ ...prev, [key]: updated }));
        return;
      }

      const target = users[key];
      if (!target) return;
      const caller = sessionEmail ? users[sessionEmail] : null;
      if (target.role === 'superadmin') throw new Error('Нельзя изменить роль супер админа');
      if ((role === 'admin' || target.role === 'admin') && caller?.role !== 'superadmin') {
        throw new Error('Назначать и изменять администраторов может только супер админ');
      }
      const updated = { ...target, role };
      const next = { ...users, [key]: updated };
      setUsers(next);
      writeLocalUsers(next);
    },
    [users, serverMode, sessionEmail]
  );

  const promoteByCode = useCallback(
    async (code) => {
      const trimmed = String(code).trim();
      if (!trimmed) throw new Error('Укажите ID-код');

      if (serverMode) {
        const updated = await api.promoteByCode(trimmed);
        setUsers((prev) => ({ ...prev, [updated.email]: updated }));
        return updated;
      }

      const target = Object.values(users).find((u) => u.code === trimmed);
      if (!target) throw new Error('Пользователь с таким ID не найден');
      const updated = { ...target, role: 'admin' };
      const next = { ...users, [target.email]: updated };
      setUsers(next);
      writeLocalUsers(next);
      return updated;
    },
    [users, serverMode]
  );

  const createShop = useCallback(
    async (name) => {
      const trimmed = String(name).trim();
      if (!trimmed) throw new Error('Укажите название магазина');

      if (serverMode) {
        const shop = await api.createShop(trimmed);
        setShops((prev) => [shop, ...prev]);
        return shop;
      }

      const taken = new Set(shops.map((s) => s.code).filter(Boolean));
      let code;
      do {
        code = generateCode();
      } while (taken.has(code));
      const shop = { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: trimmed, code };
      const next = [shop, ...shops];
      setShops(next);
      writeLocalShops(next);
      return shop;
    },
    [serverMode, shops]
  );

  const assignToShop = useCallback(
    async (userCode, shopCode) => {
      const userCodeTrimmed = String(userCode).trim();
      const shopCodeTrimmed = String(shopCode).trim();
      if (!userCodeTrimmed || !shopCodeTrimmed) throw new Error('Укажите ID пользователя и код магазина');

      if (serverMode) {
        const updated = await api.assignToShop(userCodeTrimmed, shopCodeTrimmed);
        setUsers((prev) => ({ ...prev, [updated.email]: updated }));
        return updated;
      }

      const target = Object.values(users).find((u) => u.code === userCodeTrimmed);
      if (!target) throw new Error('Пользователь с таким ID не найден');
      if (target.role === 'admin' || target.role === 'superadmin') {
        throw new Error('Администраторов нельзя привязать к магазину');
      }
      const shop = shops.find((s) => s.code === shopCodeTrimmed);
      if (!shop) throw new Error('Магазин с таким кодом не найден');

      const updated = { ...target, shopId: shop.id, role: target.role === 'customer' ? 'seller' : target.role };
      const next = { ...users, [target.email]: updated };
      setUsers(next);
      writeLocalUsers(next);
      return updated;
    },
    [users, shops, serverMode]
  );

  const currentUser = serverMode ? serverUser : sessionEmail ? users[sessionEmail] || null : null;

  const value = useMemo(
    () => ({
      users,
      shops,
      currentUser,
      requestCode,
      verifyCode,
      registerLocal,
      loginLocal,
      logout,
      setRole,
      promoteByCode,
      createShop,
      assignToShop,
      isAdmin: currentUser?.role === 'admin' || currentUser?.role === 'superadmin',
      isSuperadmin: currentUser?.role === 'superadmin',
      isSeller: currentUser?.role === 'seller' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin',
      serverMode,
    }),
    [
      users,
      shops,
      currentUser,
      requestCode,
      verifyCode,
      registerLocal,
      loginLocal,
      logout,
      setRole,
      promoteByCode,
      createShop,
      assignToShop,
      serverMode,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
