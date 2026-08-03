import { Link } from 'react-router-dom';
import { CATEGORIES, PRODUCTS } from '../data.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const deals = PRODUCTS.filter((p) => p.discount >= 20).slice(0, 8);
  const popular = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 8);

  return (
    <main className="container">
      <section className="hero">
        <div>
          <h1>Мужская одежда со скидками до 70%</h1>
          <p>Футболки, рубашки, брюки, верхняя одежда, обувь и аксессуары — всё для мужского гардероба с быстрой доставкой.</p>
          <Link to="/catalog" className="btn">Перейти в каталог</Link>
        </div>
        <div className="hero-emoji">👔</div>
      </section>

      <section className="section">
        <div className="section-title"><span>Категории</span></div>
        <div className="cat-tiles">
          {CATEGORIES.map((c) => (
            <Link key={c.id} className="cat-tile" to={`/catalog?category=${c.id}`}>
              <span className="cat-tile-icon">{c.icon}</span>
              {c.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <span>🔥 Товары дня</span>
          <Link to="/catalog">Смотреть всё</Link>
        </div>
        <div className="product-grid">
          {deals.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <span>Популярное</span>
          <Link to="/catalog">Смотреть всё</Link>
        </div>
        <div className="product-grid">
          {popular.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </main>
  );
}
