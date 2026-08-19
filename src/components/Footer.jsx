import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data.js';

export default function Footer() {
  return (
    <footer id="site-footer">
      <div className="container footer-inner">
        <div className="footer-col">
          <div className="logo footer-logo">
            Одежда<span>PRO</span>
          </div>
          <p className="footer-text">ОдеждаPRO — надёжный интернет-магазин на ваш вкус.</p>
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
            <li>+996 555 03 13 11</li>
            <li>bakhtiarovabdurahmon@gmail.com</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">© {new Date().getFullYear()} ОдеждаPRO</div>
      </div>
    </footer>
  );
}
