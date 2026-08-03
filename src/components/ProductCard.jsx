import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useStore, formatPrice } from '../store.jsx';
import Stars from './Stars.jsx';

export default function ProductCard({ product: p }) {
  const { isFavorite, toggleFavorite, addToCart } = useStore();
  const [added, setAdded] = useState(false);
  const fav = isFavorite(p.id);

  return (
    <div className="product-card">
      <Link className="product-card-media" to={`/product/${p.id}`} style={{ background: p.image ? '#fff' : p.color }}>
        {p.image ? (
          <img className="product-card-photo" src={p.image} alt={p.title} />
        ) : (
          <span className="product-card-emoji">{p.emoji}</span>
        )}
        {p.discount ? <span className="badge-discount">-{p.discount}%</span> : null}
        <button
          type="button"
          className={`fav-btn ${fav ? 'active' : ''}`}
          aria-label="В избранное"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(p.id);
          }}
        >
          {fav ? '♥' : '♡'}
        </button>
      </Link>
      <div className="product-card-body">
        <Link className="product-card-title" to={`/product/${p.id}`}>
          {p.title}
        </Link>
        <div className="product-card-rating">
          <Stars rating={p.rating} />
          <span className="rating-value">{p.rating}</span>
          <span className="rating-reviews">({p.reviews})</span>
        </div>
        <div className="product-card-price">
          <span className="price-current">{formatPrice(p.price)}</span>
          {p.oldPrice ? <span className="price-old">{formatPrice(p.oldPrice)}</span> : null}
        </div>
        <button
          type="button"
          className={`btn btn-primary btn-add-cart ${added ? 'added' : ''}`}
          onClick={() => {
            addToCart(p.id, 1);
            setAdded(true);
            setTimeout(() => setAdded(false), 1200);
          }}
        >
          {added ? 'Добавлено ✓' : 'В корзину'}
        </button>
      </div>
    </div>
  );
}
