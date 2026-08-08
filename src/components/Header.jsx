import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { CATEGORIES } from '../data.js';
import { useStore, formatPrice } from '../store.jsx';
import { useAuth, ROLE_LABELS } from '../auth.jsx';
import AddProductModal from './AddProductModal.jsx';

export default function Header() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [navOpen, setNavOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { cartCount, favoritesCount, allProducts } = useStore();
  const { currentUser, logout, isSeller, isAdmin } = useAuth();

  const promoItems = allProducts.filter((p) => p.discount >= 20).slice(0, 12);

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    navigate('/catalog' + (q ? `?q=${encodeURIComponent(q)}` : ''));
  }

  return (
    <div className="header-top">
      <div className="container header-top-inner">
        <Link className="logo" to="/">
          Одежда<span>PRO</span>
        </Link>
        <button className="burger" type="button" onClick={() => setNavOpen((v) => !v)}>
          <span className="burger-icon">☰</span> Каталог
        </button>
        <form className="search-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Найти на ОдеждаPRO"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" aria-label="Найти">🔍</button>
        </form>
        <div className="header-actions">
          <Link to="/gift" className="header-action">
            <span className="header-action-icon">🎁</span>
            <span className="header-action-label">Подарок</span>
          </Link>
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

      <div className="container user-bar">
        {currentUser ? (
          <>
            <span className="user-bar-name">
              {currentUser.name} <span className="user-bar-role">· {ROLE_LABELS[currentUser.role]}</span>
            </span>
            {isSeller ? (
              <button type="button" className="user-bar-btn user-bar-btn-primary" onClick={() => setAddOpen(true)}>
                + Добавить товар
              </button>
            ) : null}
            {isAdmin ? (
              <Link to="/admin" className="user-bar-btn">Админ-панель</Link>
            ) : null}
            <button type="button" className="user-bar-btn" onClick={logout}>Выйти</button>
          </>
        ) : (
          <Link to="/login" className="user-bar-btn user-bar-btn-primary">Войти / Регистрация</Link>
        )}
      </div>

      <div className="container promo-strip-wrap">
        <div className="promo-strip">
          {promoItems.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="promo-item" style={{ background: p.image ? '#fff' : p.color }}>
              <span className="promo-item-badge">-{p.discount}%</span>
              {p.image ? <img className="promo-item-photo" src={p.image} alt="" /> : <span className="promo-item-emoji">{p.emoji}</span>}
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

      {addOpen ? <AddProductModal onClose={() => setAddOpen(false)} /> : null}
    </div>
  );
}
