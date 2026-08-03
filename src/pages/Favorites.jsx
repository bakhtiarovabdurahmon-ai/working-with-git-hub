import { Link } from 'react-router-dom';
import { getProductById } from '../data.js';
import { useStore } from '../store.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Favorites() {
  const { favorites } = useStore();
  const products = Object.keys(favorites).map(getProductById).filter(Boolean);

  return (
    <main className="container">
      <h1>Избранное</h1>

      {products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-emoji">♡</span>
          <h2>Список избранного пуст</h2>
          <p>Добавляйте понравившиеся товары нажатием на сердечко.</p>
          <Link className="btn btn-primary" to="/catalog">В каталог</Link>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
