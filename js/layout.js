// Рендер общего хедера и футера (переиспользуется на всех страницах)

function renderHeader(activeSearchValue = '') {
  const el = document.getElementById('site-header');
  if (!el) return;
  el.innerHTML = `
    <div class="header-top">
      <div class="container header-top-inner">
        <a class="logo" href="index.html">Wild<span>Basket</span></a>
        <button class="burger" id="catalog-toggle" type="button">
          <span class="burger-icon">☰</span> Каталог
        </button>
        <form class="search-form" id="search-form">
          <input type="text" id="search-input" placeholder="Найти на WildBasket" value="${escapeHtml(activeSearchValue)}" autocomplete="off" />
          <button type="submit" aria-label="Найти">🔍</button>
        </form>
        <div class="header-actions">
          <a href="favorites.html" class="header-action">
            <span class="header-action-icon">♡<span class="badge" data-fav-count>0</span></span>
            <span class="header-action-label">Избранное</span>
          </a>
          <a href="cart.html" class="header-action">
            <span class="header-action-icon">🛒<span class="badge" data-cart-count>0</span></span>
            <span class="header-action-label">Корзина</span>
          </a>
        </div>
      </div>
      <div class="container promo-strip-wrap">
        <div class="promo-strip" id="promo-strip">
          ${PRODUCTS.filter((p) => p.discount >= 20)
            .slice(0, 12)
            .map(
              (p) => `
              <a href="product.html?id=${p.id}" class="promo-item" style="background:${p.color}">
                <span class="promo-item-badge">-${p.discount}%</span>
                <span class="promo-item-emoji">${p.emoji}</span>
                <span class="promo-item-price">${formatPrice(p.price)}</span>
              </a>`
            )
            .join('')}
        </div>
      </div>
    </div>
    <nav class="category-nav" id="category-nav">
      <div class="container category-nav-inner">
        ${CATEGORIES.map((c) => `<a href="catalog.html?category=${c.id}" class="category-pill"><span>${c.icon}</span>${c.title}</a>`).join('')}
      </div>
    </nav>
  `;

  const form = document.getElementById('search-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('search-input').value.trim();
    window.location.href = 'catalog.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  });

  const toggle = document.getElementById('catalog-toggle');
  const nav = document.getElementById('category-nav');
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
}

function renderMobileTabbar() {
  if (document.getElementById('mobile-tabbar')) return;
  const path = window.location.pathname.split('/').pop() || 'index.html';
  const tabs = [
    { href: 'index.html', icon: '🏠', label: 'Главная', match: ['index.html', ''] },
    { href: 'catalog.html', icon: '📦', label: 'Каталог', match: ['catalog.html'] },
    { href: 'favorites.html', icon: '♡', label: 'Избранное', match: ['favorites.html'], badge: 'fav' },
    { href: 'cart.html', icon: '🛒', label: 'Корзина', match: ['cart.html'], badge: 'cart' },
  ];
  const bar = document.createElement('nav');
  bar.id = 'mobile-tabbar';
  bar.innerHTML = tabs
    .map((t) => {
      const active = t.match.includes(path);
      const badgeAttr = t.badge === 'fav' ? 'data-fav-count' : t.badge === 'cart' ? 'data-cart-count' : '';
      return `
        <a href="${t.href}" class="tabbar-item ${active ? 'active' : ''}">
          <span class="tabbar-icon">${t.icon}${badgeAttr ? `<span class="badge tabbar-badge" ${badgeAttr}>0</span>` : ''}</span>
          <span class="tabbar-label">${t.label}</span>
        </a>`;
    })
    .join('');
  document.body.appendChild(bar);
}

function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.innerHTML = `
    <div class="container footer-inner">
      <div class="footer-col">
        <div class="logo footer-logo">Wild<span>Basket</span></div>
        <p class="footer-text">Учебный клон маркетплейса. Демонстрационный проект, не является настоящим интернет-магазином.</p>
      </div>
      <div class="footer-col">
        <h4>Покупателям</h4>
        <ul>
          <li><a href="catalog.html">Каталог</a></li>
          <li><a href="cart.html">Корзина</a></li>
          <li><a href="favorites.html">Избранное</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Категории</h4>
        <ul>
          ${CATEGORIES.slice(0, 4).map((c) => `<li><a href="catalog.html?category=${c.id}">${c.title}</a></li>`).join('')}
        </ul>
      </div>
      <div class="footer-col">
        <h4>Контакты</h4>
        <ul>
          <li>8 800 000-00-00</li>
          <li>support@wildbasket.demo</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container">© ${new Date().getFullYear()} WildBasket — демо-проект</div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function starsHtml(rating) {
  const full = Math.round(rating);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= full ? 'filled' : ''}">★</span>`;
  }
  return html;
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
  renderMobileTabbar();
  updateHeaderCounters();
});
