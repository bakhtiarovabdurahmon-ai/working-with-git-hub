import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../auth.jsx';
import { useStore } from '../store.jsx';
import { api } from '../api.js';

const SPIN_COST = 500;
const PRIZES_KEY = 'wb_clone_wheel_prizes';
const USERS_KEY = 'wb_clone_users';

const TYPE_LABELS = { clothing: 'Одежда', cashback: 'Кешбек', discount: 'Скидка' };
const SEGMENT_COLORS = ['#1c3a5e', '#d4632a', '#2f567f', '#e8813f', '#12283f', '#f0955c'];
// Расстояние подписи от центра колеса (radius самого колеса — 140px на
// десктопе, 110px на мобильном, см. .wheel-outer) — чуть меньше половины,
// чтобы подписи не наезжали друг на друга у края.
const WHEEL_LABEL_RADIUS = 72;

function readLocalPrizes() {
  try {
    return JSON.parse(localStorage.getItem(PRIZES_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function writeLocalPrizes(prizes) {
  localStorage.setItem(PRIZES_KEY, JSON.stringify(prizes));
}

export default function Wheel() {
  const { currentUser, isSeller, setCashbackBalance } = useAuth();
  const { serverMode } = useStore();
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [redeemQr, setRedeemQr] = useState(null);

  const [label, setLabel] = useState('');
  const [type, setType] = useState('clothing');
  const [value, setValue] = useState('');

  const loadPrizes = useCallback(async () => {
    if (serverMode === null) return;
    setLoading(true);
    try {
      if (serverMode) {
        setPrizes(await api.getWheelPrizes());
      } else {
        setPrizes(readLocalPrizes());
      }
    } finally {
      setLoading(false);
    }
  }, [serverMode]);

  useEffect(() => {
    loadPrizes();
  }, [loadPrizes]);

  async function handleAddPrize(e) {
    e.preventDefault();
    setError(null);
    const trimmed = label.trim();
    if (!trimmed) return setError('Укажите название приза');
    const valueNum = Number(value) || 0;
    if ((type === 'cashback' || type === 'discount') && valueNum <= 0) {
      return setError('Укажите сумму/процент больше нуля');
    }

    try {
      if (serverMode) {
        const created = await api.addWheelPrize({ label: trimmed, type, value: valueNum });
        setPrizes((prev) => [created, ...prev]);
      } else {
        const created = {
          id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          label: trimmed,
          type,
          value: type === 'clothing' ? 0 : valueNum,
          sellerEmail: currentUser.email,
          shopId: currentUser.shopId || null,
        };
        const next = [created, ...readLocalPrizes()];
        writeLocalPrizes(next);
        setPrizes(next);
      }
      setLabel('');
      setValue('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeletePrize(id) {
    try {
      if (serverMode) {
        await api.deleteWheelPrize(id);
      } else {
        const next = readLocalPrizes().filter((p) => p.id !== id);
        writeLocalPrizes(next);
      }
      setPrizes((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSpin() {
    if (spinning) return;
    setError(null);
    setResult(null);
    setRedeemQr(null);
    if (!currentUser) return setError('Нужен вход, чтобы крутить колесо');
    if ((currentUser.cashback || 0) < SPIN_COST) return setError(`Нужно минимум ${SPIN_COST} кешбека`);
    if (prizes.length === 0) return setError('Пока нет доступных призов');

    setSpinning(true);
    try {
      let prize;
      let newBalance;
      let redemptionToken = null;

      if (serverMode) {
        const res = await api.spinWheel();
        prize = res.prize;
        newBalance = res.cashback;
        redemptionToken = res.redemptionToken;
      } else {
        const pool = readLocalPrizes();
        prize = pool[Math.floor(Math.random() * pool.length)];
        const users = JSON.parse(localStorage.getItem(USERS_KEY)) || {};
        const balance = (currentUser.cashback || 0) - SPIN_COST + (prize.type === 'cashback' ? prize.value : 0);
        newBalance = balance;
        users[currentUser.email] = { ...users[currentUser.email], cashback: balance };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }

      const idx = Math.max(0, prizes.findIndex((p) => p.id === prize.id));
      const segmentAngle = 360 / prizes.length;
      const targetOffset = 360 - (idx * segmentAngle + segmentAngle / 2);
      setRotation((prev) => prev - (prev % 360) + 360 * 5 + targetOffset);

      setTimeout(async () => {
        setResult(prize);
        setCashbackBalance(newBalance);
        setSpinning(false);
        if (redemptionToken) {
          const url = `${window.location.origin}/#/redeem/${redemptionToken}`;
          try {
            setRedeemQr(await QRCode.toDataURL(url, { width: 220, margin: 1 }));
          } catch (e) {
            setRedeemQr(null);
          }
        } else {
          setRedeemQr(null);
        }
      }, 4000);
    } catch (err) {
      setError(err.message);
      setSpinning(false);
    }
  }

  if (!currentUser) {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Нужен вход</h2>
          <p>Колесо фортуны доступно только авторизованным покупателям.</p>
          <Link className="btn btn-primary" to="/login">Войти</Link>
        </div>
      </main>
    );
  }

  const segmentAngle = prizes.length > 0 ? 360 / prizes.length : 0;

  return (
    <main className="container">
      <h1>Колесо фортуны</h1>
      <p className="pay-sub">Прокрутка стоит {SPIN_COST} кешбека. Ваш баланс: <strong>{currentUser.cashback || 0} кешбек</strong></p>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="wheel-layout">
        <div className="wheel-outer">
          <div className="wheel-pointer">▼</div>
          {prizes.length === 0 ? (
            <div className="wheel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>
              {loading ? 'Загрузка…' : 'Пока нет призов'}
            </div>
          ) : (
            <div
              className="wheel"
              style={{
                transform: `rotate(${rotation}deg)`,
                background: `conic-gradient(${prizes
                  .map((p, i) => `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`)
                  .join(', ')})`,
              }}
            >
              {prizes.map((p, i) => {
                const angle = i * segmentAngle + segmentAngle / 2;
                const flipped = angle > 90 && angle < 270;
                return (
                  <span
                    key={p.id}
                    className="wheel-segment-label"
                    style={{ transform: `rotate(${angle}deg) translate(${WHEEL_LABEL_RADIUS}px)` }}
                  >
                    <span
                      className="wheel-segment-label-text"
                      style={{ transform: `translate(-50%, -50%) ${flipped ? 'rotate(180deg)' : ''}` }}
                    >
                      {p.label}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <button className="btn btn-primary btn-large" type="button" disabled={spinning || prizes.length === 0} onClick={handleSpin}>
            {spinning ? 'Крутится…' : `Крутить за ${SPIN_COST}`}
          </button>

          {result ? (
            <div className="pay-amount" style={{ marginTop: 16 }}>
              <div className="pay-amount-label">Ваш приз</div>
              <div className="pay-amount-value" style={{ fontSize: 18 }}>{result.label}</div>
              {result.type === 'cashback' ? <div className="pay-sub" style={{ marginTop: 6 }}>+{result.value} кешбека уже зачислено</div> : null}
              {result.type === 'discount' ? <div className="pay-sub" style={{ marginTop: 6 }}>Скидка {result.value}% — покажите продавцу</div> : null}
              {result.type === 'clothing' ? <div className="pay-sub" style={{ marginTop: 6 }}>Обратитесь к продавцу, чтобы забрать приз</div> : null}
              {redeemQr ? (
                <div style={{ marginTop: 14, textAlign: 'center' }}>
                  <img src={redeemQr} alt="QR для выдачи приза" className="qr-real" />
                  <div className="qr-note">Покажите этот QR продавцу — он отсканирует и выдаст приз</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {isSeller ? (
        <section className="section">
          <div className="section-title"><span>Управление призами</span></div>
          <form onSubmit={handleAddPrize} className="form-row-split" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label className="form-label">Название приза</label>
              <input className="form-input" type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Например, Шапка зимняя" />
            </div>
            <div>
              <label className="form-label">Тип</label>
              <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="clothing">Одежда</option>
                <option value="cashback">Кешбек</option>
                <option value="discount">Скидка %</option>
              </select>
            </div>
            <div>
              <label className="form-label">{type === 'discount' ? 'Процент' : 'Сумма'}</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={type === 'clothing'}
                placeholder={type === 'clothing' ? '—' : '0'}
              />
            </div>
            <button className="btn btn-primary" type="submit">Добавить</button>
          </form>

          <div className="admin-table-wrap" style={{ marginTop: 16 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Значение</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {prizes.map((p) => (
                  <tr key={p.id}>
                    <td>{p.label}</td>
                    <td>{TYPE_LABELS[p.type]}</td>
                    <td>{p.type === 'clothing' ? '—' : p.type === 'discount' ? `${p.value}%` : p.value}</td>
                    <td>
                      <button className="pay-ghost-btn" type="button" onClick={() => handleDeletePrize(p.id)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
