// Логика страницы товара

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('product-root');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const product = getProductById(params.get('id'));

  if (!product) {
    root.innerHTML = `<div class="empty-state"><h2>Товар не найден</h2><a class="btn btn-primary" href="catalog.html">Перейти в каталог</a></div>`;
    return;
  }

  document.title = product.title + ' — WildBasket';

  const fav = isFavorite(product.id);
  root.innerHTML = `
    <div class="breadcrumbs">
      <a href="index.html">Главная</a> /
      <a href="catalog.html?category=${product.category}">${getCategoryTitle(product.category)}</a> /
      <span>${escapeHtml(product.title)}</span>
    </div>
    <div class="product-page">
      <div class="product-gallery" style="background:${product.color}">
        <span class="product-gallery-emoji">${product.emoji}</span>
        ${product.discount ? `<span class="badge-discount large">-${product.discount}%</span>` : ''}
      </div>
      <div class="product-info">
        <h1>${escapeHtml(product.title)}</h1>
        <div class="product-meta">
          <span class="product-rating">${starsHtml(product.rating)} <strong>${product.rating}</strong></span>
          <span class="product-reviews">${product.reviews} отзывов</span>
          <span class="product-brand">Бренд: <strong>${product.brand}</strong></span>
        </div>
        <div class="product-price-block">
          <span class="price-current large">${formatPrice(product.price)}</span>
          ${product.oldPrice ? `<span class="price-old large">${formatPrice(product.oldPrice)}</span>` : ''}
          ${product.discount ? `<span class="save-badge">Экономия ${formatPrice(product.oldPrice - product.price)}</span>` : ''}
        </div>
        <div class="stock-status ${product.inStock ? 'in-stock' : 'out-stock'}">
          ${product.inStock ? '✓ В наличии' : 'Нет в наличии'}
        </div>
        <div class="size-picker">
          <div class="size-picker-label">Размер:</div>
          <div class="size-options">
            ${product.sizes.map((s, i) => `<button type="button" class="size-option ${i === 0 ? 'selected' : ''}" data-size="${s}">${s}</button>`).join('')}
          </div>
        </div>
        <div class="qty-picker">
          <span>Количество:</span>
          <button type="button" id="qty-minus">−</button>
          <span id="qty-value">1</span>
          <button type="button" id="qty-plus">+</button>
        </div>
        <div class="product-actions">
          <button class="btn btn-primary btn-large" id="add-cart-btn" ${product.inStock ? '' : 'disabled'}>Добавить в корзину</button>
          <button class="btn btn-outline btn-large fav-toggle-btn ${fav ? 'active' : ''}" id="fav-btn">${fav ? '♥ В избранном' : '♡ В избранное'}</button>
        </div>
        <div class="product-description">
          <h3>Описание</h3>
          <p>${escapeHtml(product.description)}</p>
        </div>
      </div>
    </div>
    <div class="recommend-section">
      <h2>Похожие товары</h2>
      <div class="product-grid" id="related-grid"></div>
    </div>
  `;

  let qty = 1;
  const qtyValue = document.getElementById('qty-value');
  document.getElementById('qty-minus').addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyValue.textContent = qty;
  });
  document.getElementById('qty-plus').addEventListener('click', () => {
    qty = qty + 1;
    qtyValue.textContent = qty;
  });

  root.querySelectorAll('.size-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.size-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  const addBtn = document.getElementById('add-cart-btn');
  addBtn.addEventListener('click', () => {
    addToCart(product.id, qty);
    addBtn.textContent = 'Добавлено в корзину ✓';
    setTimeout(() => (addBtn.textContent = 'Добавить в корзину'), 1500);
  });

  const favBtn = document.getElementById('fav-btn');
  favBtn.addEventListener('click', () => {
    const active = toggleFavorite(product.id);
    favBtn.classList.toggle('active', active);
    favBtn.textContent = active ? '♥ В избранном' : '♡ В избранное';
  });

  const relatedGrid = document.getElementById('related-grid');
  const related = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  relatedGrid.innerHTML = related.map(productCardHtml).join('');
  attachProductCardEvents(relatedGrid);
});

function onFavoritesChanged() {}
