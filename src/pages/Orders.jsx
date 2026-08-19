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
  shipping: 'Оплата подтверждена — продавец готовит отправку',
  completed: 'Товар отправлен',
};

const FULFILLMENT_LABELS = {
  delivery: '🚚 Доставка',
  reserve: '🏬 Бронирование',
};

function DeliveryAddress({ address }) {
  const urlMatch = address.match(/https?:\/\/\S+/);
  if (!urlMatch) return <div className="pay-sub">📍 {address}</div>;
  const [url] = urlMatch;
  const before = address.slice(0, urlMatch.index).trim();
  return (
    <div className="pay-sub">
      📍 {before} <a href={url} target="_blank" rel="noreferrer">Открыть на карте</a>
    </div>
  );
}

function ShipmentProof({ order }) {
  if (!order.shipmentImage) return null;
  return (
    <div className="pay-sub" style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '4px 0' }}>
      <span>📦 Продавец отправил товар — подтверждение:</span>
      <a href={order.shipmentImage} target="_blank" rel="noreferrer">
        <img
          src={order.shipmentImage}
          alt="Подтверждение отправки"
          style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, border: '1px solid var(--border)' }}
        />
      </a>
      {order.shipmentNote ? <span>«{order.shipmentNote}»</span> : null}
    </div>
  );
}

function ShipForm({ order, onSubmit }) {
  const [image, setImage] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    setError(null);
    setSending(true);
    try {
      await onSubmit(order.id, image, note.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <label className={`pay-upload-box ${fileName ? 'has-file' : ''}`}>
        <span className="pay-upload-icon">📎</span>
        <span>{fileName ? '✓ ' + fileName : 'Скриншот отправки (например, из приложения службы доставки)'}</span>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </label>
      <input
        className="form-input"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Комментарий покупателю (необязательно)"
      />
      {error ? <div className="form-error">{error}</div> : null}
      <button className="btn btn-primary" type="button" disabled={!image || sending} onClick={handleSubmit}>
        {sending ? 'Отправляем…' : 'Товар отправлен'}
      </button>
    </div>
  );
}

function OrderCard({ order, children }) {
  return (
    <div className="cart-item" style={{ flexWrap: 'wrap', gap: 12 }}>
      <div className="cart-item-info" style={{ flex: '1 1 260px' }}>
        <div className="cart-item-title">Заказ {order.orderNumber}</div>
        <div className="cart-item-brand">{FULFILLMENT_LABELS[order.fulfillment]} · {order.buyerName || order.buyerEmail}</div>
        <div className="pay-sub" style={{ margin: '4px 0' }}>
          {order.items.map((it, i) => (
            <div key={i}>{it.title}{it.size ? `, размер ${it.size}` : ''} × {it.qty}</div>
          ))}
        </div>
        {order.fulfillment === 'delivery' && order.deliveryAddress ? (
          <DeliveryAddress address={order.deliveryAddress} />
        ) : null}
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
  const { myOrders, sellerOrders, confirmStock, markPaid, confirmPayment, shipOrder } = useOrders();
  const [payOrder, setPayOrder] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);

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

  async function handlePaid(receiptFileName, receiptImage) {
    await markPaid(payOrder.id, receiptFileName, receiptImage);
  }

  async function handleShip(id, image, note) {
    await shipOrder(id, image, note);
  }

  const pendingStockOrder = myOrders.find((o) => o.status === 'pending_stock');
  const pendingPaymentOrder = myOrders.find((o) => o.status === 'payment_review');
  const pendingShippingOrder = myOrders.find((o) => o.status === 'shipping');
  const pendingOrder = pendingStockOrder || pendingPaymentOrder || pendingShippingOrder;
  const showOverlay = !!pendingOrder && !overlayDismissed;
  const overlayText = pendingStockOrder
    ? 'Проверка товара на наличие — это может занять несколько минут'
    : pendingPaymentOrder
    ? 'Оплата на проверке у супер админа — это может занять некоторое время'
    : 'Оплата подтверждена — продавец готовит и отправляет ваш товар';

  return (
    <main className="container">
      <h1>Заказы</h1>
      {actionError ? <div className="form-error">{actionError}</div> : null}

      {showOverlay ? (
        <div className="stock-check-overlay" onClick={() => setOverlayDismissed(true)}>
          <div className="stock-check-box" onClick={(e) => e.stopPropagation()}>
            <div className="stock-check-dots">
              <span /><span /><span /><span /><span />
            </div>
            <div className="stock-check-text">
              {overlayText}
            </div>
            <button className="pay-ghost-btn" type="button" onClick={() => setOverlayDismissed(true)}>
              Скрыть
            </button>
          </div>
        </div>
      ) : null}

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
              <ShipmentProof order={order} />
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
                {order.status === 'payment_review' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    {order.receiptImage ? (
                      <a href={order.receiptImage} target="_blank" rel="noreferrer">
                        <img
                          src={order.receiptImage}
                          alt="Квитанция"
                          style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, border: '1px solid var(--border)' }}
                        />
                      </a>
                    ) : (
                      <span className="pay-sub">Квитанция не прикреплена</span>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => handleConfirmPayment(order.id)}
                      >
                        Подтвердить перевод
                      </button>
                    </div>
                  </div>
                ) : null}
                {order.status === 'shipping' ? <ShipForm order={order} onSubmit={handleShip} /> : null}
              </OrderCard>
            ))
          )}
        </section>
      ) : null}

      {payOrder ? <PaymentModal order={payOrder} onClose={() => setPayOrder(null)} onPaid={handlePaid} /> : null}
    </main>
  );
}
