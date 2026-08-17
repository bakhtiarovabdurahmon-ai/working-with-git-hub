import { Link } from 'react-router-dom';

export default function CashbackModal({ balance, onClose }) {
  return (
    <div className="pay-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pay-modal cashback-modal">
        <button className="pay-close-btn" type="button" onClick={onClose}>✕</button>
        <div className="cashback-card cashback-card-large">
          <span className="cashback-card-icon">💳</span>
          <span className="cashback-card-value">{balance} кешбек</span>
        </div>
        <p className="pay-sub" style={{ textAlign: 'center', marginTop: 12 }}>
          Кешбек начисляет продавец после подтверждения заказа. Тратится только на прокрутку колеса фортуны.
        </p>
        <Link className="btn btn-primary btn-large" style={{ width: '100%', marginTop: 8 }} to="/wheel" onClick={onClose}>
          🎡 Крутить колесо
        </Link>
      </div>
    </div>
  );
}
