import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../auth.jsx';
import { useStore, formatPrice } from '../store.jsx';

export default function Admin() {
  const { currentUser, users, shops, setRole, promoteByCode, createShop, assignToShop, serverMode } = useAuth();
  const { customProducts, removeProduct } = useStore();
  const [actionError, setActionError] = useState(null);
  const [promoteCode, setPromoteCode] = useState('');
  const [promoteError, setPromoteError] = useState(null);
  const [promoteNotice, setPromoteNotice] = useState(null);

  const [shopName, setShopName] = useState('');
  const [shopError, setShopError] = useState(null);
  const [shopNotice, setShopNotice] = useState(null);

  const [assignUserCode, setAssignUserCode] = useState('');
  const [assignShopCode, setAssignShopCode] = useState('');
  const [assignError, setAssignError] = useState(null);
  const [assignNotice, setAssignNotice] = useState(null);

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

  async function handleCreateShop(e) {
    e.preventDefault();
    setShopError(null);
    setShopNotice(null);
    try {
      const shop = await createShop(shopName);
      setShopNotice(`Магазин «${shop.name}» создан, его код — ${shop.code}`);
      setShopName('');
    } catch (err) {
      setShopError(err.message);
    }
  }

  async function handleAssign(e) {
    e.preventDefault();
    setAssignError(null);
    setAssignNotice(null);
    try {
      const updated = await assignToShop(assignUserCode, assignShopCode);
      const shop = shops.find((s) => s.id === updated.shopId || s.code === assignShopCode.trim());
      setAssignNotice(`${updated.name} (${updated.email}) добавлен(а) в магазин «${shop ? shop.name : assignShopCode}»`);
      setAssignUserCode('');
      setAssignShopCode('');
    } catch (err) {
      setAssignError(err.message);
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
  const shopNameById = Object.fromEntries(shops.map((s) => [s.id, s.name]));

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
        <div className="section-title"><span>Магазины ({shops.length})</span></div>
        <p className="pay-sub">
          В одном магазине может быть несколько сотрудников (2-3 человека) — все они видят и подтверждают общие заказы.
        </p>

        <form onSubmit={handleCreateShop} style={{ display: 'flex', gap: 8, maxWidth: 360, marginBottom: 12 }}>
          <input
            className="form-input"
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Название магазина"
          />
          <button className="btn btn-primary" type="submit">Создать</button>
        </form>
        {shopError ? <div className="form-error">{shopError}</div> : null}
        {shopNotice ? <div className="form-notice">{shopNotice}</div> : null}

        {shops.length > 0 ? (
          <div className="admin-table-wrap" style={{ marginBottom: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Магазин</th>
                  <th>Код</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <form onSubmit={handleAssign} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 480 }}>
          <input
            className="form-input"
            type="text"
            inputMode="numeric"
            value={assignUserCode}
            onChange={(e) => setAssignUserCode(e.target.value)}
            placeholder="ID сотрудника"
            style={{ flex: '1 1 140px' }}
          />
          <select
            className="form-input"
            value={assignShopCode}
            onChange={(e) => setAssignShopCode(e.target.value)}
            style={{ flex: '1 1 160px' }}
          >
            <option value="">Выберите магазин</option>
            {shops.map((s) => (
              <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">Добавить в магазин</button>
        </form>
        {assignError ? <div className="form-error">{assignError}</div> : null}
        {assignNotice ? <div className="form-notice">{assignNotice}</div> : null}
      </section>

      <section className="section">
        <div className="section-title"><span>Пользователи и роли</span></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>ID</th>
                <th>Магазин</th>
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
                    <td>{u.shopId ? (shopNameById[u.shopId] || '—') : '—'}</td>
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
                  <th>Магазин</th>
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
                    <td>{p.shopId ? (shopNameById[p.shopId] || '—') : '—'}</td>
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
