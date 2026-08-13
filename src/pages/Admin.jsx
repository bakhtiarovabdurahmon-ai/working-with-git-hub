import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../auth.jsx';
import { useStore, formatPrice } from '../store.jsx';

export default function Admin() {
  const { currentUser, users, setRole, promoteByCode, serverMode } = useAuth();
  const { customProducts, removeProduct } = useStore();
  const [actionError, setActionError] = useState(null);
  const [promoteCode, setPromoteCode] = useState('');
  const [promoteError, setPromoteError] = useState(null);
  const [promoteNotice, setPromoteNotice] = useState(null);

  async function handleRoleChange(email, role) {
    setActionError(null);
    try {
      await setRole(email, role);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleRemoveProduct(id) {
    setActionError(null);
    try {
      await removeProduct(id);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handlePromoteByCode(e) {
    e.preventDefault();
    setPromoteError(null);
    setPromoteNotice(null);
    try {
      const updated = await promoteByCode(promoteCode);
      setPromoteNotice(`${updated.name} (${updated.email}) назначен(а) администратором`);
      setPromoteCode('');
    } catch (err) {
      setPromoteError(err.message);
    }
  }

  if (!currentUser) {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Нужен вход</h2>
          <p>Эта страница доступна только администратору.</p>
          <Link className="btn btn-primary" to="/login">Войти</Link>
        </div>
      </main>
    );
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'superadmin') {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Доступ запрещён</h2>
          <p>Эта страница доступна только администратору.</p>
        </div>
      </main>
    );
  }

  const isSuperadmin = currentUser.role === 'superadmin';
  const userList = Object.values(users);

  return (
    <main className="container">
      <h1>Админ-панель</h1>
      <p className="pay-sub">
        {serverMode ? '🟢 Данные хранятся на сервере (MongoDB), общие для всех посетителей.' : '🟡 Автономный режим: данные только в этом браузере.'}
      </p>
      {actionError ? <div className="form-error">{actionError}</div> : null}

      {isSuperadmin ? (
        <section className="section">
          <div className="section-title"><span>Назначить администратора по ID</span></div>
          <form onSubmit={handlePromoteByCode} style={{ display: 'flex', gap: 8, maxWidth: 320 }}>
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              value={promoteCode}
              onChange={(e) => setPromoteCode(e.target.value)}
              placeholder="Например, 127"
            />
            <button className="btn btn-primary" type="submit">Назначить</button>
          </form>
          {promoteError ? <div className="form-error">{promoteError}</div> : null}
          {promoteNotice ? <div className="form-notice">{promoteNotice}</div> : null}
        </section>
      ) : null}

      <section className="section">
        <div className="section-title"><span>Пользователи и роли</span></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>ID</th>
                <th>Роль</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => {
                const isOwnRow = u.email === currentUser.email;
                const isSuperadminRow = u.role === 'superadmin';
                const isAdminRow = u.role === 'admin';
                const canEdit = !isOwnRow && !isSuperadminRow && (isSuperadmin || !isAdminRow);
                return (
                  <tr key={u.email}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.code || '—'}</td>
                    <td>
                      {canEdit ? (
                        <select
                          className="form-input"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.email, e.target.value)}
                        >
                          <option value="customer">{ROLE_LABELS.customer}</option>
                          <option value="seller">{ROLE_LABELS.seller}</option>
                          {isSuperadmin ? <option value="admin">{ROLE_LABELS.admin}</option> : null}
                        </select>
                      ) : (
                        ROLE_LABELS[u.role]
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="pay-sub">
          Свою роль изменить нельзя — чтобы не потерять доступ к админ-панели. Назначать и изменять администраторов
          может только супер админ.
        </p>
      </section>

      <section className="section">
        <div className="section-title"><span>Товары, добавленные продавцами ({customProducts.length})</span></div>
        {customProducts.length === 0 ? (
          <p className="pay-sub">Пока никто ничего не добавил.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Продавец</th>
                  <th>Цена</th>
                  <th>Кол-во</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customProducts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.sellerEmail || '—'}</td>
                    <td>{formatPrice(p.price)}</td>
                    <td>{p.qty}</td>
                    <td>
                      <button type="button" className="user-bar-btn" onClick={() => handleRemoveProduct(p.id)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
