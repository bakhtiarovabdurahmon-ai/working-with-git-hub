import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { register, login, currentUser, serverMode } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Вы уже вошли как {currentUser.name}</h2>
          <p>Роль: {currentUser.role}</p>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/')}>На главную</button>
        </div>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        const user = await register(name, email, password);
        setNotice(user.role === 'admin' ? 'Вы первый пользователь — вам выдана роль администратора.' : null);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <div className="auth-box">
        <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>

        {serverMode === null ? (
          <p className="pay-sub">Подключение к серверу…</p>
        ) : serverMode ? (
          <p className="pay-sub">
            🟢 Подключено к серверу: аккаунты хранятся в базе данных (пароли хешируются), видны при заходе с любого устройства.
          </p>
        ) : (
          <p className="pay-sub">
            🟡 Автономный режим: сервер недоступен, аккаунт сохранится только в этом браузере (localStorage), без шифрования.
            Не используйте настоящий пароль, которым вы пользуетесь где-то ещё.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <div className="form-row">
              <label className="form-label">Имя</label>
              <input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться" />
            </div>
          ) : null}
          <div className="form-row">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-row">
            <label className="form-label">Пароль</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error ? <div className="form-error">{error}</div> : null}
          {notice ? <div className="form-notice">{notice}</div> : null}

          <button className="btn btn-primary btn-large" style={{ width: '100%' }} type="submit" disabled={serverMode === null || submitting}>
            {submitting ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <button
          type="button"
          className="pay-ghost-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </main>
  );
}
