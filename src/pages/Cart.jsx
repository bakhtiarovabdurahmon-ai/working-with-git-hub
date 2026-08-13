import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, formatPrice } from '../store.jsx';
import PaymentModal from '../components/PaymentModal.jsx';

export default function Cart() {
  const { cart, setCartQty, removeFromCart, clearCart, getProduct } = useStore();
  const [payOpen, setPayOpen] = useState(false);
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

  function handlePaymentDone() {
    clearCart();
    setPayOpen(false);
    setSuccess(true);
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
            <button className="btn btn-primary" id="checkout-btn" type="button" onClick={() => setPayOpen(true)}>
              Оформить заказ
            </button>
            {success ? (
              <div className="checkout-success" style={{ display: 'block' }}>
                Заказ оформлен! Это демо-магазин, реальная оплата не выполнялась.
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      {payOpen ? (
        <PaymentModal items={items} cart={cart} total={total} onClose={() => setPayOpen(false)} onDone={handlePaymentDone} />
      ) : null}
    </main>
  );
}
