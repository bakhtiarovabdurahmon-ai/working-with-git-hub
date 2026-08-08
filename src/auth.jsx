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

const USERS_KEY = 'wb_clone_users';
const SESSION_KEY = 'wb_clone_session';
const TOKEN_KEY = 'wb_clone_token';

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

export const ROLE_LABELS = {
  admin: 'Администратор',
  seller: 'Продавец',
  customer: 'Покупатель',
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [users, setUsers] = useState({});
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
  // once we know the current user really is an admin (only admins are
  // allowed to call GET /api/users, see server/routes/users.js).
  useEffect(() => {
    if (!serverMode || serverUser?.role !== 'admin') return;
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

  // Серверный режим: вход по коду из письма (без пароля).
  const requestCode = useCallback(async (name, email) => {
    const key = email.trim().toLowerCase();
    if (!key) throw new Error('Укажите email');
    await api.requestCode(key, name);
  }, []);

  const verifyCode = useCallback(async (email, code) => {
    const key = email.trim().toLowerCase();
    const { user, token } = await api.verifyCode(key, code);
    setAuthToken(token);
    localStorage.setItem(TOKEN_KEY, token);
    setHasToken(true);
    setServerUser(user);
    setUsers((prev) => ({ ...prev, [key]: user }));
    setSessionEmail(key);
    localStorage.setItem(SESSION_KEY, key);
    return user;
  }, []);

  // Локальный режим (сервер недоступен): обычная пара email+пароль в localStorage.
  const registerLocal = useCallback(
    (name, email, password) => {
      const key = email.trim().toLowerCase();
      if (!key || !password) throw new Error('Заполните email и пароль');
      if (users[key]) throw new Error('Такой email уже зарегистрирован');
      const isFirstUser = Object.keys(users).length === 0;
      const user = { name: name.trim() || key, email: key, password, role: isFirstUser ? 'admin' : 'customer' };
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
    setSessionEmail(null);
    localStorage.removeItem(SESSION_KEY);
    setServerUser(null);
    setAuthToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setHasToken(false);
  }, []);

  const setRole = useCallback(
    async (email, role) => {
      const key = email.trim().toLowerCase();

      if (serverMode) {
        const updated = await api.setUserRole(key, role);
        setUsers((prev) => ({ ...prev, [key]: updated }));
        return;
      }

      if (!users[key]) return;
      const updated = { ...users[key], role };
      const next = { ...users, [key]: updated };
      setUsers(next);
      writeLocalUsers(next);
    },
    [users, serverMode]
  );

  const currentUser = serverMode ? serverUser : sessionEmail ? users[sessionEmail] || null : null;

  const value = useMemo(
    () => ({
      users,
      currentUser,
      requestCode,
      verifyCode,
      registerLocal,
      loginLocal,
      logout,
      setRole,
      isAdmin: currentUser?.role === 'admin',
      isSeller: currentUser?.role === 'seller' || currentUser?.role === 'admin',
      serverMode,
    }),
    [users, currentUser, requestCode, verifyCode, registerLocal, loginLocal, logout, setRole, serverMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
