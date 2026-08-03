import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data.js';

export default function Footer() {
  return (
    <footer id="site-footer">
      <div className="container footer-inner">
        <div className="footer-col">
          <div className="logo footer-logo">
            Wild<span>Basket</span>
          </div>
          <p className="footer-text">Магазин мужской одежды. Учебный демо-проект, не является настоящим интернет-магазином.</p>
        </div>
        <div className="footer-col">
          <h4>Покупателям</h4>
          <ul>
            <li><Link to="/catalog">Каталог</Link></li>
            <li><Link to="/cart">Корзина</Link></li>
            <li><Link to="/favorites">Избранное</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Категории</h4>
          <ul>
            {CATEGORIES.slice(0, 4).map((c) => (
              <li key={c.id}>
                <Link to={`/catalog?category=${c.id}`}>{c.title}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-col">
          <h4>Контакты</h4>
          <ul>
            <li>8 800 000-00-00</li>
            <li>support@wildbasket.demo</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">© {new Date().getFullYear()} WildBasket — демо-проект</div>
      </div>
    </footer>
  );
}
