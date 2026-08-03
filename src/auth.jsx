// Демо-авторизация: аккаунты и роли (admin/seller/customer) хранятся локально
// в браузере (localStorage). Это НЕ настоящая защищённая аутентификация —
// пароли не шифруются и ни с каким сервером не сверяются. Не используйте
// здесь настоящие пароли, которыми вы пользуетесь где-то ещё.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const USERS_KEY = 'wb_clone_users';
const SESSION_KEY = 'wb_clone_session';

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export const ROLE_LABELS = {
  admin: 'Администратор',
  seller: 'Продавец',
  customer: 'Покупатель',
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => readUsers());
  const [sessionEmail, setSessionEmail] = useState(() => localStorage.getItem(SESSION_KEY) || null);

  const persistUsers = useCallback((next) => {
    setUsers(next);
    writeUsers(next);
  }, []);

  const register = useCallback(
    (name, email, password) => {
      const key = email.trim().toLowerCase();
      if (!key || !password) throw new Error('Заполните email и пароль');
      if (users[key]) throw new Error('Такой email уже зарегистрирован');
      const isFirstUser = Object.keys(users).length === 0;
      const user = {
        name: name.trim() || key,
        email: key,
        password,
        role: isFirstUser ? 'admin' : 'customer',
      };
      const next = { ...users, [key]: user };
      persistUsers(next);
      setSessionEmail(key);
      localStorage.setItem(SESSION_KEY, key);
      return user;
    },
    [users, persistUsers]
  );

  const login = useCallback(
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
  }, []);

  const setRole = useCallback(
    (email, role) => {
      const key = email.trim().toLowerCase();
      if (!users[key]) return;
      const next = { ...users, [key]: { ...users[key], role } };
      persistUsers(next);
    },
    [users, persistUsers]
  );

  const currentUser = sessionEmail ? users[sessionEmail] || null : null;

  const value = useMemo(
    () => ({
      users,
      currentUser,
      register,
      login,
      logout,
      setRole,
      isAdmin: currentUser?.role === 'admin',
      isSeller: currentUser?.role === 'seller' || currentUser?.role === 'admin',
    }),
    [users, currentUser, register, login, logout, setRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
