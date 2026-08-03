import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProductById, getCategoryTitle, PRODUCTS } from '../data.js';
import { useStore, formatPrice } from '../store.jsx';
import Stars from '../components/Stars.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Product() {
  const { id } = useParams();
  const product = getProductById(id);
  const { isFavorite, toggleFavorite, addToCart } = useStore();
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState(product ? product.sizes[0] : null);
  const [addedText, setAddedText] = useState(null);

  useEffect(() => {
    if (product) document.title = product.title + ' — WildBasket';
  }, [product]);

  useEffect(() => {
    setQty(1);
    setSize(product ? product.sizes[0] : null);
  }, [id]);

  if (!product) {
    return (
      <main className="container">
        <div className="empty-state">
          <h2>Товар не найден</h2>
          <Link className="btn btn-primary" to="/catalog">Перейти в каталог</Link>
        </div>
      </main>
    );
  }

  const fav = isFavorite(product.id);
  const related = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  function handleAddToCart() {
    addToCart(product.id, qty);
    setAddedText('Добавлено в корзину ✓');
    setTimeout(() => setAddedText(null), 1500);
  }

  return (
    <main className="container">
      <div className="breadcrumbs">
        <Link to="/">Главная</Link> /{' '}
        <Link to={`/catalog?category=${product.category}`}>{getCategoryTitle(product.category)}</Link> /{' '}
        <span>{product.title}</span>
      </div>
      <div className="product-page">
        <div className="product-gallery" style={{ background: product.color }}>
          <span className="product-gallery-emoji">{product.emoji}</span>
          {product.discount ? <span className="badge-discount large">-{product.discount}%</span> : null}
        </div>
        <div className="product-info">
          <h1>{product.title}</h1>
          <div className="product-meta">
            <span className="product-rating">
              <Stars rating={product.rating} /> <strong>{product.rating}</strong>
            </span>
            <span className="product-reviews">{product.reviews} отзывов</span>
            <span className="product-brand">
              Бренд: <strong>{product.brand}</strong>
            </span>
          </div>
          <div className="product-price-block">
            <span className="price-current large">{formatPrice(product.price)}</span>
            {product.oldPrice ? <span className="price-old large">{formatPrice(product.oldPrice)}</span> : null}
            {product.discount ? <span className="save-badge">Экономия {formatPrice(product.oldPrice - product.price)}</span> : null}
          </div>
          <div className={`stock-status ${product.inStock ? 'in-stock' : 'out-stock'}`}>
            {product.inStock ? '✓ В наличии' : 'Нет в наличии'}
          </div>
          <div className="size-picker">
            <div className="size-picker-label">Размер:</div>
            <div className="size-options">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`size-option ${s === size ? 'selected' : ''}`}
                  onClick={() => setSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="qty-picker">
            <span>Количество:</span>
            <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))}>−</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty((v) => v + 1)}>+</button>
          </div>
          <div className="product-actions">
            <button className="btn btn-primary btn-large" disabled={!product.inStock} onClick={handleAddToCart}>
              {addedText || 'Добавить в корзину'}
            </button>
            <button
              className={`btn btn-outline btn-large fav-toggle-btn ${fav ? 'active' : ''}`}
              type="button"
              onClick={() => toggleFavorite(product.id)}
            >
              {fav ? '♥ В избранном' : '♡ В избранное'}
            </button>
          </div>
          <div className="product-description">
            <h3>Описание</h3>
            <p>{product.description}</p>
          </div>
        </div>
      </div>
      <div className="recommend-section">
        <h2>Похожие товары</h2>
        <div className="product-grid">
          {related.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </main>
  );
}
