import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCategoryTitle } from '../data.js';
import { useStore, formatPrice, isOrderable, sizeHasStock } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import Stars from '../components/Stars.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ReviewsSection from '../components/ReviewsSection.jsx';

export default function Product() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    isFavorite,
    toggleFavorite,
    addToCart,
    allProducts,
    getProduct,
    myStockForProduct,
    removeMyStock,
    sellSize,
    serverMode,
  } = useStore();
  const { isAdmin } = useAuth();
  const product = getProduct(id);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState(product ? product.sizes[0] : null);
  const [addedText, setAddedText] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [sellingSize, setSellingSize] = useState(null);
  const [sellError, setSellError] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (product) document.title = product.title + ' — ОдеждаPRO';
  }, [product]);

  useEffect(() => {
    setQty(1);
    setSize(product ? product.sizes[0] : null);
    setActivePhoto(0);
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
  const related = allProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const orderable = isOrderable(product, serverMode);
  const sizeAvailable = size ? sizeHasStock(product, size) : false;
  const myStock = myStockForProduct(product.id);
  const canDelete = !product.isDemo && !!myStock;
  const photos = product.images && product.images.length > 0 ? product.images : product.image ? [product.image] : [];

  function handleAddToCart() {
    if (!orderable || !sizeAvailable) return;
    addToCart(product.id, size, qty);
    setAddedText('Добавлено в корзину ✓');
    setTimeout(() => setAddedText(null), 1500);
  }

  async function handleDelete() {
    if (!myStock) return;
    if (!window.confirm(isAdmin ? 'Удалить сток этого магазина по товару?' : 'Убрать этот товар из вашего склада?')) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await removeMyStock(myStock.id);
      navigate('/catalog');
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  async function handleSell(sellSizeValue) {
    if (!myStock) return;
    setSellError(null);
    setSellingSize(sellSizeValue);
    try {
      await sellSize(myStock.id, sellSizeValue);
    } catch (err) {
      setSellError(err.message);
    } finally {
      setSellingSize(null);
    }
  }

  return (
    <main className="container">
      <div className="breadcrumbs">
        <Link to="/">Главная</Link> /{' '}
        <Link to={`/catalog?category=${product.category}`}>{getCategoryTitle(product.category)}</Link> /{' '}
        <span>{product.title}</span>
      </div>
      <div className="product-page">
        <div className="product-gallery-wrap">
          <div className="product-gallery" style={{ background: photos.length > 0 ? '#fff' : product.color }}>
            {photos.length > 0 ? (
              <img className="product-gallery-photo" src={photos[activePhoto] || photos[0]} alt={product.title} />
            ) : (
              <span className="product-gallery-emoji">{product.emoji}</span>
            )}
            {product.discount ? <span className="badge-discount large">-{product.discount}%</span> : null}
          </div>
          {photos.length > 1 ? (
            <div className="product-gallery-thumbs">
              {photos.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className={`product-gallery-thumb ${i === activePhoto ? 'active' : ''}`}
                  onClick={() => setActivePhoto(i)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
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
          <div className={`stock-status ${sizeAvailable ? 'in-stock' : 'out-stock'}`}>
            {sizeAvailable ? '✓ В наличии' : 'Нет в наличии в этом размере'}
          </div>
          {!orderable ? (
            <div className="stock-status out-stock">Витринный товар — недоступен для заказа</div>
          ) : null}
          <div className="size-picker">
            <div className="size-picker-label">Размер:</div>
            <div className="size-options">
              {product.sizes.map((s) => {
                const available = sizeHasStock(product, s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`size-option ${s === size ? 'selected' : ''}`}
                    style={available ? undefined : { opacity: 0.4 }}
                    onClick={() => setSize(s)}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="qty-picker">
            <span>Количество:</span>
            <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))}>−</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty((v) => v + 1)}>+</button>
          </div>
          <div className="product-actions">
            <button className="btn btn-primary btn-large" disabled={!sizeAvailable || !orderable} onClick={handleAddToCart}>
              {!orderable ? 'Демо-товар' : addedText || 'Добавить в корзину'}
            </button>
            <button
              className={`btn btn-outline btn-large fav-toggle-btn ${fav ? 'active' : ''}`}
              type="button"
              onClick={() => toggleFavorite(product.id)}
            >
              {fav ? '♥ В избранном' : '♡ В избранное'}
            </button>
            {canDelete ? (
              <button className="btn btn-outline btn-large" type="button" disabled={deleting} onClick={handleDelete}>
                {deleting ? 'Удаление…' : '🗑 Удалить товар'}
              </button>
            ) : null}
          </div>
          {deleteError ? <div className="form-error">{deleteError}</div> : null}
          {myStock ? (
            <div className="product-description">
              <h3>Мой сток — быстрая продажа</h3>
              <p className="pay-sub">Продали товар не через сайт (например, в магазине)? Отметьте размер — остаток сразу уменьшится.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myStock.sizes.map((s) => (
                  <div key={s.size} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ minWidth: 40 }}>{s.size}</span>
                    <span className="pay-sub">{s.qty} шт</span>
                    <button
                      className="pay-ghost-btn"
                      type="button"
                      disabled={s.qty <= 0 || sellingSize === s.size}
                      onClick={() => handleSell(s.size)}
                    >
                      {sellingSize === s.size ? 'Продаём…' : 'Продали'}
                    </button>
                  </div>
                ))}
              </div>
              {sellError ? <div className="form-error">{sellError}</div> : null}
            </div>
          ) : null}
          <div className="product-description">
            <h3>Описание</h3>
            <p>{product.description}</p>
          </div>
        </div>
      </div>
      <ReviewsSection productId={product.id} />
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
