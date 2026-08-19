import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../auth.jsx';
import { useStore, formatPrice } from '../store.jsx';
import { api } from '../api.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Дневной отчёт супер админа: сумма завершённых заказов за день и 15%
// комиссии сайта с неё, плюс отдельный калькулятор для любой другой суммы.
function DailyReportSection() {
  const [date, setDate] = useState(todayStr());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calcInput, setCalcInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getDailyReport(date)
      .then((r) => !cancelled && setReport(r))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const calcNum = Number(calcInput) || 0;

  return (
    <section className="section">
      <div className="section-title"><span>Дневной отчёт (15% комиссии сайта)</span></div>
      <div className="form-row" style={{ maxWidth: 220 }}>
        <label className="form-label">Дата</label>
        <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} />
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? (
        <p className="pay-sub">Загрузка…</p>
      ) : report ? (
        <div className="pay-amount" style={{ maxWidth: 360 }}>
          <div className="pay-amount-label">Завершённых заказов за {report.date}: {report.ordersCount}</div>
          <div className="pay-receipt-line"><span>Общая сумма продаж</span><span>{formatPrice(report.totalSales)}</span></div>
          <div className="pay-receipt-line total"><span>Комиссия сайта (15%)</span><span>{formatPrice(report.commission)}</span></div>
        </div>
      ) : null}

      <div className="form-row" style={{ maxWidth: 320, marginTop: 20 }}>
        <label className="form-label">Калькулятор: 15% от любой суммы</label>
        <input
          className="form-input"
          type="number"
          min="0"
          value={calcInput}
          onChange={(e) => setCalcInput(e.target.value)}
          placeholder="Введите сумму, сом"
        />
        {calcInput ? (
          <p className="pay-sub" style={{ marginTop: 8 }}>
            15% от {formatPrice(calcNum)} = <strong>{formatPrice(Math.round(calcNum * 0.15))}</strong>
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default function Admin() {
  const { currentUser, users, shops, setRole, promoteByCode, createShop, assignToShop, serverMode } = useAuth();
  const { removeMyStock, serverMode: storeServerMode } = useStore();
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

  const [stockList, setStockList] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);

  useEffect(() => {
    if (!storeServerMode) {
      setStockLoading(false);
      return;
    }
    let cancelled = false;
    api
      .getAllStock()
      .then((list) => !cancelled && setStockList(list))
      .catch(() => {})
      .finally(() => !cancelled && setStockLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storeServerMode]);

  async function handleRoleChange(email, role) {
    setActionError(null);
    try {
      await setRole(email, role);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleRemoveStock(stockId) {
    setActionError(null);
    try {
      await removeMyStock(stockId);
      setStockList((prev) => prev.filter((s) => s.id !== stockId));
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

      {isSuperadmin && storeServerMode ? <DailyReportSection /> : null}

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
                <th>Смена</th>
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
                    <td>{u.role === 'seller' ? (u.onShift === false ? '🔴 закрыта' : '🟢 открыта') : '—'}</td>
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

      {storeServerMode ? (
        <section className="section">
          <div className="section-title"><span>Сток по товарам ({stockList.length})</span></div>
          <p className="pay-sub">
            Один товар (карточка) может продавать сразу несколько магазинов — каждая строка ниже это сток одного
            магазина по одной карточке.
          </p>
          {stockLoading ? (
            <p className="pay-sub">Загрузка…</p>
          ) : stockList.length === 0 ? (
            <p className="pay-sub">Пока никто ничего не добавил.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Продавец</th>
                    <th>Магазин</th>
                    <th>Код</th>
                    <th>Размеры/остаток</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stockList.map((s) => (
                    <tr key={s.id}>
                      <td>{s.product?.title || '—'}</td>
                      <td>{s.sellerEmail}</td>
                      <td>{s.shopId ? (shopNameById[s.shopId] || '—') : '—'}</td>
                      <td>{s.code}</td>
                      <td>{s.sizes.map((sz) => `${sz.size}×${sz.qty}`).join(', ')}</td>
                      <td>
                        <button type="button" className="user-bar-btn" onClick={() => handleRemoveStock(s.id)}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
