import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

const TYPE_LABELS = { clothing: 'Одежда', cashback: 'Кешбек', discount: 'Скидка' };

export default function Redeem() {
  const { token } = useParams();
  const { currentUser, isSeller } = useAuth();
  const [redemption, setRedemption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getRedemption(token)
      .then((r) => !cancelled && setRedemption(r))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleIssue() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.redeemPrize(token);
      setRedemption(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Загрузка…</h2>
        </div>
      </main>
    );
  }

  if (error && !redemption) {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Талон не найден</h2>
          <p>{error}</p>
          <Link className="btn btn-primary" to="/">На главную</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Приз колеса фортуны</h1>
      <div className="auth-box" style={{ maxWidth: 420 }}>
        <div className="pay-amount">
          <div className="pay-amount-label">Название приза</div>
          <div className="pay-amount-value" style={{ fontSize: 22 }}>{redemption.prizeLabel}</div>
        </div>
        <p className="pay-sub">Тип: {TYPE_LABELS[redemption.prizeType]}</p>
        {redemption.prizeType === 'discount' ? <p className="pay-sub">Скидка: {redemption.prizeValue}%</p> : null}
        {redemption.prizeType === 'cashback' ? <p className="pay-sub">Начислено: {redemption.prizeValue} кешбека</p> : null}
        <p className="pay-sub">Покупатель: {redemption.buyerEmail}</p>

        {error ? <div className="form-error">{error}</div> : null}

        {redemption.redeemed ? (
          <div className="pay-status-text" style={{ marginTop: 12 }}>
            ✅ Приз уже выдан{redemption.redeemedBy ? ` (${redemption.redeemedBy})` : ''}
          </div>
        ) : currentUser && isSeller ? (
          <button className="btn btn-primary btn-large" style={{ width: '100%', marginTop: 12 }} type="button" disabled={busy} onClick={handleIssue}>
            {busy ? 'Выдаём…' : 'Выдать приз'}
          </button>
        ) : (
          <p className="pay-sub" style={{ marginTop: 12 }}>Войдите как продавец, чтобы выдать этот приз.</p>
        )}
      </div>
    </main>
  );
}
