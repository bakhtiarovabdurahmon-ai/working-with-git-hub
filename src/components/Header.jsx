import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { CATEGORIES, PRODUCTS } from '../data.js';
import { useStore, formatPrice } from '../store.jsx';

export default function Header() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [navOpen, setNavOpen] = useState(false);
  const { cartCount, favoritesCount } = useStore();

  const promoItems = PRODUCTS.filter((p) => p.discount >= 20).slice(0, 12);

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    navigate('/catalog' + (q ? `?q=${encodeURIComponent(q)}` : ''));
  }

  return (
    <div className="header-top">
      <div className="container header-top-inner">
        <Link className="logo" to="/">
          Wild<span>Basket</span>
        </Link>
        <button className="burger" type="button" onClick={() => setNavOpen((v) => !v)}>
          <span className="burger-icon">☰</span> Каталог
        </button>
        <form className="search-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Найти на WildBasket"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" aria-label="Найти">🔍</button>
        </form>
        <div className="header-actions">
          <Link to="/favorites" className="header-action">
            <span className="header-action-icon">
              ♡<span className="badge" style={{ display: favoritesCount > 0 ? 'flex' : 'none' }}>{favoritesCount}</span>
            </span>
            <span className="header-action-label">Избранное</span>
          </Link>
          <Link to="/cart" className="header-action">
            <span className="header-action-icon">
              🛒<span className="badge" style={{ display: cartCount > 0 ? 'flex' : 'none' }}>{cartCount}</span>
            </span>
            <span className="header-action-label">Корзина</span>
          </Link>
        </div>
      </div>
      <div className="container promo-strip-wrap">
        <div className="promo-strip">
          {promoItems.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="promo-item" style={{ background: p.color }}>
              <span className="promo-item-badge">-{p.discount}%</span>
              <span className="promo-item-emoji">{p.emoji}</span>
              <span className="promo-item-price">{formatPrice(p.price)}</span>
            </Link>
          ))}
        </div>
      </div>
      <nav className={`category-nav ${navOpen ? 'open' : ''}`}>
        <div className="container category-nav-inner">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/catalog?category=${c.id}`} className="category-pill" onClick={() => setNavOpen(false)}>
              <span>{c.icon}</span>
              {c.title}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
