import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store.jsx';

const TABS = [
  { to: '/', icon: '🏠', label: 'Главная' },
  { to: '/catalog', icon: '📦', label: 'Каталог' },
  { to: '/favorites', icon: '♡', label: 'Избранное', badge: 'fav' },
  { to: '/cart', icon: '🛒', label: 'Корзина', badge: 'cart' },
];

export default function MobileTabbar() {
  const location = useLocation();
  const { cartCount, favoritesCount } = useStore();

  return (
    <nav id="mobile-tabbar">
      {TABS.map((t) => {
        const active = t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to);
        const badgeCount = t.badge === 'fav' ? favoritesCount : t.badge === 'cart' ? cartCount : 0;
        return (
          <Link key={t.to} to={t.to} className={`tabbar-item ${active ? 'active' : ''}`}>
            <span className="tabbar-icon">
              {t.icon}
              {t.badge ? (
                <span className="badge tabbar-badge" style={{ display: badgeCount > 0 ? 'flex' : 'none' }}>
                  {badgeCount}
                </span>
              ) : null}
            </span>
            <span className="tabbar-label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
