// Логика страницы корзины

document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('cart-list');
  if (!list) return;

  function render() {
    const cart = getCart();
    const ids = Object.keys(cart);
    const empty = document.getElementById('cart-empty');
    const summary = document.getElementById('cart-summary');

    if (ids.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      summary.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    summary.style.display = 'block';

    let total = 0;
    let totalOld = 0;
    let itemsCount = 0;

    list.innerHTML = ids
      .map((id) => {
        const p = getProductById(id);
        if (!p) return '';
        const qty = cart[id];
        total += p.price * qty;
        totalOld += (p.oldPrice || p.price) * qty;
        itemsCount += qty;
        return `
          <div class="cart-item" data-id="${p.id}">
            <a href="product.html?id=${p.id}" class="cart-item-media" style="background:${p.color}">${p.emoji}</a>
            <div class="cart-item-info">
              <a href="product.html?id=${p.id}" class="cart-item-title">${escapeHtml(p.title)}</a>
              <div class="cart-item-brand">${p.brand}</div>
              <button class="cart-item-remove" data-remove="${p.id}">Удалить</button>
            </div>
            <div class="cart-item-qty">
              <button type="button" data-dec="${p.id}">−</button>
              <span>${qty}</span>
              <button type="button" data-inc="${p.id}">+</button>
            </div>
            <div class="cart-item-price">
              <span class="price-current">${formatPrice(p.price * qty)}</span>
              ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice * qty)}</span>` : ''}
            </div>
          </div>
        `;
      })
      .join('');

    document.getElementById('summary-items-count').textContent = itemsCount;
    document.getElementById('summary-total').textContent = formatPrice(total);
    const discount = totalOld - total;
    const discountRow = document.getElementById('summary-discount-row');
    if (discount > 0) {
      discountRow.style.display = 'flex';
      document.getElementById('summary-discount').textContent = '−' + formatPrice(discount);
    } else {
      discountRow.style.display = 'none';
    }

    list.querySelectorAll('[data-inc]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-inc');
        setCartQty(id, (getCart()[id] || 0) + 1);
        render();
      })
    );
    list.querySelectorAll('[data-dec]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dec');
        setCartQty(id, (getCart()[id] || 0) - 1);
        render();
      })
    );
    list.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', () => {
        removeFromCart(btn.getAttribute('data-remove'));
        render();
      })
    );
  }

  window.onPaymentDone = () => {
    render();
    document.getElementById('checkout-success').style.display = 'block';
  };

  render();
});
