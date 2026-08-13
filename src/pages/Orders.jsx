import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useOrders } from '../orders.jsx';
import { formatPrice } from '../store.jsx';
import PaymentModal from '../components/PaymentModal.jsx';

const STATUS_LABELS = {
  pending_stock: 'Ждём подтверждения продавца',
  out_of_stock: 'Товара нет в наличии',
  awaiting_payment: 'Товар в наличии — можно оплатить',
  payment_review: 'Оплата на проверке у супер админа',
  completed: 'Готово, товар выдан',
};

const FULFILLMENT_LABELS = {
  delivery: '🚚 Доставка',
  reserve: '🏬 Бронирование',
};

function OrderCard({ order, children }) {
  return (
    <div className="cart-item" style={{ flexWrap: 'wrap', gap: 12 }}>
      <div className="cart-item-info" style={{ flex: '1 1 260px' }}>
        <div className="cart-item-title">Заказ {order.orderNumber}</div>
        <div className="cart-item-brand">{FULFILLMENT_LABELS[order.fulfillment]} · {order.buyerName || order.buyerEmail}</div>
        <div className="pay-sub" style={{ margin: '4px 0' }}>
          {order.items.map((it, i) => (
            <div key={i}>{it.title} × {it.qty}</div>
          ))}
        </div>
        <div className="pay-sub"><strong>{STATUS_LABELS[order.status] || order.status}</strong></div>
      </div>
      <div className="cart-item-price" style={{ flex: '0 0 auto' }}>
        <span className="price-current">{formatPrice(order.total)}</span>
      </div>
      {children ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>{children}</div> : null}
    </div>
  );
}

export default function Orders() {
  const { currentUser } = useAuth();
  const { myOrders, sellerOrders, confirmStock, markPaid, confirmPayment } = useOrders();
  const [payOrder, setPayOrder] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (!currentUser) {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Нужен вход</h2>
          <p>Заказы видны только авторизованным пользователям.</p>
          <Link className="btn btn-primary" to="/login">Войти</Link>
        </div>
      </main>
    );
  }

  const isSuperadmin = currentUser.role === 'superadmin';
  const isSellerRole = ['seller', 'admin', 'superadmin'].includes(currentUser.role);

  async function handleStock(id, inStock) {
    setActionError(null);
    setBusyId(id);
    try {
      await confirmStock(id, inStock);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmPayment(id) {
    setActionError(null);
    setBusyId(id);
    try {
      await confirmPayment(id);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handlePaid(receiptFileName) {
    await markPaid(payOrder.id, receiptFileName);
  }

  return (
    <main className="container">
      <h1>Заказы</h1>
      {actionError ? <div className="form-error">{actionError}</div> : null}

      <section className="section">
        <div className="section-title"><span>Мои заказы ({myOrders.length})</span></div>
        {myOrders.length === 0 ? (
          <p className="pay-sub">Вы пока ничего не заказывали.</p>
        ) : (
          myOrders.map((order) => (
            <OrderCard key={order.id} order={order}>
              {order.status === 'awaiting_payment' ? (
                <button className="btn btn-primary" type="button" onClick={() => setPayOrder(order)}>
                  Оплатить
                </button>
              ) : null}
            </OrderCard>
          ))
        )}
      </section>

      {isSellerRole ? (
        <section className="section">
          <div className="section-title"><span>Заказы на подтверждение ({sellerOrders.length})</span></div>
          {sellerOrders.length === 0 ? (
            <p className="pay-sub">Пока нет заказов.</p>
          ) : (
            sellerOrders.map((order) => (
              <OrderCard key={order.id} order={order}>
                {order.status === 'pending_stock' ? (
                  <>
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => handleStock(order.id, true)}
                    >
                      ✓ Есть в наличии
                    </button>
                    <button
                      className="pay-ghost-btn"
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => handleStock(order.id, false)}
                    >
                      ✕ Нет в наличии
                    </button>
                  </>
                ) : null}
                {order.status === 'payment_review' && isSuperadmin ? (
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => handleConfirmPayment(order.id)}
                  >
                    Подтвердить перевод
                  </button>
                ) : null}
              </OrderCard>
            ))
          )}
        </section>
      ) : null}

      {payOrder ? <PaymentModal order={payOrder} onClose={() => setPayOrder(null)} onPaid={handlePaid} /> : null}
    </main>
  );
}
