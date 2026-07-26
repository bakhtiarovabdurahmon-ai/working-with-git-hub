// Рендер карточки товара, используется в каталоге, на главной и в избранном

function productCardHtml(p) {
  const fav = isFavorite(p.id);
  return `
    <div class="product-card" data-id="${p.id}">
      <a class="product-card-media" href="product.html?id=${p.id}" style="background:${p.color}">
        <span class="product-card-emoji">${p.emoji}</span>
        ${p.discount ? `<span class="badge-discount">-${p.discount}%</span>` : ''}
        <button class="fav-btn ${fav ? 'active' : ''}" data-fav-toggle="${p.id}" aria-label="В избранное">${fav ? '♥' : '♡'}</button>
      </a>
      <div class="product-card-body">
        <a class="product-card-title" href="product.html?id=${p.id}">${escapeHtml(p.title)}</a>
        <div class="product-card-rating">
          ${starsHtml(p.rating)}
          <span class="rating-value">${p.rating}</span>
          <span class="rating-reviews">(${p.reviews})</span>
        </div>
        <div class="product-card-price">
          <span class="price-current">${formatPrice(p.price)}</span>
          ${p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : ''}
        </div>
        <button class="btn btn-primary btn-add-cart" data-add-cart="${p.id}">В корзину</button>
      </div>
    </div>
  `;
}

function attachProductCardEvents(container) {
  container.querySelectorAll('[data-fav-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-fav-toggle');
      const active = toggleFavorite(id);
      btn.classList.toggle('active', active);
      btn.textContent = active ? '♥' : '♡';
      if (typeof onFavoritesChanged === 'function') onFavoritesChanged();
    });
  });
  container.querySelectorAll('[data-add-cart]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-add-cart');
      addToCart(id, 1);
      const original = btn.textContent;
      btn.textContent = 'Добавлено ✓';
      btn.classList.add('added');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('added');
      }, 1200);
    });
  });
}
