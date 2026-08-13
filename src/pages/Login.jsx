import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../auth.jsx';

export default function Login() {
  const { requestCode, verifyCode, registerLocal, loginLocal, currentUser, serverMode } = useAuth();
  const navigate = useNavigate();

  // Локальный режим (пароль)
  const [localMode, setLocalMode] = useState('login');
  const [password, setPassword] = useState('');

  // Общие поля
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeStep, setCodeStep] = useState('email'); // 'email' | 'code'

  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Вы уже вошли как {currentUser.name}</h2>
          <p>
            Роль: {ROLE_LABELS[currentUser.role] || currentUser.role}
            {currentUser.code ? ` · ID ${currentUser.code}` : ''}
          </p>
          {notice ? <div className="form-notice">{notice}</div> : null}
          <button className="btn btn-primary" type="button" onClick={() => navigate('/')}>На главную</button>
        </div>
      </main>
    );
  }

  async function handleRequestCode(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestCode(name, email);
      setCodeStep('code');
      setNotice('Код отправлен на ' + email.trim().toLowerCase());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user, isNew } = await verifyCode(email, code);
      if (isNew && user.role === 'superadmin') {
        setNotice('Вы первый пользователь — вам выдана роль супер администратора.');
      } else if (isNew && user.code) {
        setNotice(`Ваш ID-код: ${user.code}. Сообщите его супер админу, чтобы он назначил вас администратором.`);
      } else {
        // Возвращающийся пользователь — показывать нечего, идём сразу дальше.
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLocalSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (localMode === 'register') {
        const user = registerLocal(name, email, password);
        if (user.role === 'superadmin') {
          setNotice('Вы первый пользователь — вам выдана роль супер администратора.');
        } else if (user.code) {
          setNotice(`Ваш ID-код: ${user.code}. Сообщите его супер админу, чтобы он назначил вас администратором.`);
        } else {
          navigate('/');
        }
        // Остаёмся на странице, пока не покажем уведомление выше — если
        // сразу перейти на главную, пользователь никогда не увидит свой
        // ID-код.
      } else {
        loginLocal(email, password);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <div className="auth-box">
        <h1>Вход</h1>

        {serverMode === null ? (
          <p className="pay-sub">Подключение к серверу…</p>
        ) : serverMode ? (
          <p className="pay-sub">🟢 Подключено к серверу: вход по коду из письма, без пароля.</p>
        ) : (
          <p className="pay-sub">
            🟡 Автономный режим: сервер (и рассылка писем) недоступны — вход по email+паролю, аккаунт сохранится только в этом браузере.
            Не используйте настоящий пароль, которым вы пользуетесь где-то ещё.
          </p>
        )}

        {serverMode === null ? null : serverMode ? (
          codeStep === 'email' ? (
            <form onSubmit={handleRequestCode}>
              <div className="form-row">
                <label className="form-label">Имя (для нового аккаунта)</label>
                <input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться" />
              </div>
              <div className="form-row">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              {error ? <div className="form-error">{error}</div> : null}
              <button className="btn btn-primary btn-large" style={{ width: '100%' }} type="submit" disabled={submitting}>
                {submitting ? 'Отправляем…' : 'Получить код на email'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              {notice ? <div className="form-notice">{notice}</div> : null}
              <div className="form-row">
                <label className="form-label">Код из письма</label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  autoFocus
                  required
                />
              </div>
              {error ? <div className="form-error">{error}</div> : null}
              <button className="btn btn-primary btn-large" style={{ width: '100%' }} type="submit" disabled={submitting}>
                {submitting ? 'Проверяем…' : 'Войти'}
              </button>
              <button
                type="button"
                className="pay-ghost-btn"
                onClick={() => {
                  setCodeStep('email');
                  setCode('');
                  setError(null);
                  setNotice(null);
                }}
              >
                Назад / отправить код ещё раз
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleLocalSubmit}>
            {localMode === 'register' ? (
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

            <button className="btn btn-primary btn-large" style={{ width: '100%' }} type="submit" disabled={submitting}>
              {submitting ? 'Подождите…' : localMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>
        )}

        {serverMode === false ? (
          <button
            type="button"
            className="pay-ghost-btn"
            onClick={() => {
              setLocalMode(localMode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {localMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        ) : null}
      </div>
    </main>
  );
}
