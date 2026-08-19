import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, formatPrice, isOrderable } from '../store.jsx';
import { useOrders } from '../orders.jsx';
import { useAuth } from '../auth.jsx';

export default function Cart() {
  const { cart, setCartQty, removeFromCart, clearCart, getProduct, serverMode } = useStore();
  const { createOrders } = useOrders();
  const { currentUser } = useAuth();
  const [choosing, setChoosing] = useState(false);
  const [addressStep, setAddressStep] = useState(false);
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | locating | found | denied | unsupported
  const [geoCoords, setGeoCoords] = useState(null);
  const [manualAddress, setManualAddress] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const ids = Object.keys(cart);
  let total = 0;
  let totalOld = 0;
  let itemsCount = 0;
  const items = ids.map((id) => getProduct(id)).filter(Boolean);
  items.forEach((p) => {
    const qty = cart[p.id];
    total += p.price * qty;
    totalOld += (p.oldPrice || p.price) * qty;
    itemsCount += qty;
  });
  const discount = totalOld - total;

  const hasDemoItems = items.some((p) => !isOrderable(p, serverMode));

  async function handlePlaceOrder(fulfillment, address) {
    setError(null);
    if (hasDemoItems) {
      setError('В корзине есть витринный товар, который нельзя заказать по-настоящему — удалите его, чтобы оформить заказ.');
      return;
    }
    setPlacing(true);
    try {
      const orderItems = items.map((p) => ({
        productId: p.id,
        title: p.title,
        price: p.price,
        qty: cart[p.id],
        sellerEmail: p.sellerEmail || null,
        shopId: p.shopId || null,
      }));
      await createOrders(orderItems, fulfillment, address);
      clearCart();
      setChoosing(false);
      setAddressStep(false);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  }

  // Клиент жмёт "Оформить доставку" — сначала пробуем определить его
  // местоположение через браузер. Если доступ не разрешили (или браузер не
  // поддерживает геолокацию), просим ввести адрес вручную — без адреса
  // доставку не оформить в любом случае.
  function startDeliveryFlow() {
    setError(null);
    setAddressStep(true);
    if (!navigator.geolocation) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('found');
      },
      () => setGeoStatus('denied'),
      { timeout: 10000 }
    );
  }

  function confirmDeliveryWithGeo() {
    if (!geoCoords) return;
    const address = `Координаты: ${geoCoords.lat.toFixed(6)}, ${geoCoords.lng.toFixed(6)} (https://maps.google.com/?q=${geoCoords.lat},${geoCoords.lng})`;
    handlePlaceOrder('delivery', address);
  }

  function confirmDeliveryWithManualAddress(e) {
    e.preventDefault();
    const trimmed = manualAddress.trim();
    if (!trimmed) {
      setError('Укажите адрес доставки');
      return;
    }
    handlePlaceOrder('delivery', trimmed);
  }

  if (success) {
    return (
      <main className="container">
        <h1>Корзина</h1>
        <div className="empty-state">
          <span className="empty-state-emoji">✅</span>
          <h2>Заказ отправлен продавцу!</h2>
          <p>Как только он подтвердит наличие товара, вы сможете оплатить заказ в разделе «Заказы».</p>
          <Link className="btn btn-primary" to="/orders">К заказам</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Корзина</h1>

      <div className="cart-layout">
        <div>
          {items.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-emoji">🛒</span>
              <h2>Корзина пуста</h2>
              <p>Загляните в каталог и выберите что-нибудь интересное.</p>
              <Link className="btn btn-primary" to="/catalog">В каталог</Link>
            </div>
          ) : (
            <div>
              {items.map((p) => {
                const qty = cart[p.id];
                return (
                  <div className="cart-item" key={p.id}>
                    <Link to={`/product/${p.id}`} className="cart-item-media" style={{ background: p.image ? '#fff' : p.color }}>
                      {p.image ? <img src={p.image} alt={p.title} className="cart-item-photo" /> : p.emoji}
                    </Link>
                    <div className="cart-item-info">
                      <Link to={`/product/${p.id}`} className="cart-item-title">{p.title}</Link>
                      <div className="cart-item-brand">{p.brand}</div>
                      <button className="cart-item-remove" type="button" onClick={() => removeFromCart(p.id)}>
                        Удалить
                      </button>
                    </div>
                    <div className="cart-item-qty">
                      <button type="button" onClick={() => setCartQty(p.id, qty - 1)}>−</button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => setCartQty(p.id, qty + 1)}>+</button>
                    </div>
                    <div className="cart-item-price">
                      <span className="price-current">{formatPrice(p.price * qty)}</span>
                      {p.oldPrice ? <span className="price-old">{formatPrice(p.oldPrice * qty)}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <aside className="cart-summary">
            <h3>Итого</h3>
            <div className="summary-row">
              <span>Товары, шт.</span>
              <span>{itemsCount}</span>
            </div>
            {discount > 0 ? (
              <div className="summary-row">
                <span>Скидка</span>
                <span className="success-text">−{formatPrice(discount)}</span>
              </div>
            ) : null}
            <div className="summary-row total">
              <span>К оплате</span>
              <span>{formatPrice(total)}</span>
            </div>

            {hasDemoItems ? (
              <div className="form-error">В корзине витринный товар, его нельзя заказать — удалите, чтобы продолжить.</div>
            ) : null}
            {!currentUser ? (
              <>
                <Link className="btn btn-primary" id="checkout-btn" to="/login">Войти, чтобы оформить заказ</Link>
              </>
            ) : !choosing ? (
              <button className="btn btn-primary" id="checkout-btn" type="button" disabled={hasDemoItems} onClick={() => setChoosing(true)}>
                Оформить заказ
              </button>
            ) : !addressStep ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p className="pay-sub">Как получить заказ?</p>
                <button className="btn btn-primary" type="button" disabled={placing} onClick={startDeliveryFlow}>
                  🚚 Оформить доставку
                </button>
                <button className="btn btn-primary" type="button" disabled={placing} onClick={() => handlePlaceOrder('reserve')}>
                  🏬 Забронировать
                </button>
                <button className="pay-ghost-btn" type="button" onClick={() => setChoosing(false)}>Отмена</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p className="pay-sub">Куда доставить заказ?</p>
                {geoStatus === 'locating' ? (
                  <p className="pay-sub">📍 Определяем ваше местоположение…</p>
                ) : null}
                {geoStatus === 'found' && geoCoords ? (
                  <>
                    <p className="pay-sub">📍 Местоположение определено</p>
                    <button className="btn btn-primary" type="button" disabled={placing} onClick={confirmDeliveryWithGeo}>
                      {placing ? 'Оформляем…' : 'Доставить сюда'}
                    </button>
                    <button className="pay-ghost-btn" type="button" onClick={() => setGeoStatus('denied')}>
                      Указать адрес вручную
                    </button>
                  </>
                ) : null}
                {geoStatus === 'denied' || geoStatus === 'unsupported' ? (
                  <form onSubmit={confirmDeliveryWithManualAddress} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {geoStatus === 'denied' ? (
                      <p className="pay-sub">Доступ к местоположению не разрешён — укажите адрес текстом</p>
                    ) : (
                      <p className="pay-sub">Браузер не поддерживает определение местоположения — укажите адрес текстом</p>
                    )}
                    <input
                      className="form-input"
                      type="text"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="Город, улица, дом, квартира"
                      autoFocus
                    />
                    <button className="btn btn-primary" type="submit" disabled={placing}>
                      {placing ? 'Оформляем…' : 'Оформить доставку'}
                    </button>
                  </form>
                ) : null}
                <button
                  className="pay-ghost-btn"
                  type="button"
                  onClick={() => {
                    setAddressStep(false);
                    setGeoStatus('idle');
                    setGeoCoords(null);
                    setManualAddress('');
                  }}
                >
                  Назад
                </button>
              </div>
            )}
            {error ? <div className="form-error">{error}</div> : null}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
