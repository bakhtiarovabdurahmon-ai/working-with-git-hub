import { useState } from 'react';
import { useStore } from '../store.jsx';
import { sizeFromMeasurements, styleFromAge, pickGiftProducts } from '../giftFinder.js';
import ProductCard from '../components/ProductCard.jsx';
import TryOnModal from '../components/TryOnModal.jsx';

export default function GiftFinder() {
  const { allProducts } = useStore();

  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const [photoUrl, setPhotoUrl] = useState(null);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tryOnProduct, setTryOnProduct] = useState(null);

  function handlePhotoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result);
    reader.readAsDataURL(file);
  }

  function handleParamsSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!height || !weight) return setError('Укажите рост и вес');
    const size = sizeFromMeasurements(height, weight);
    const style = styleFromAge(age);
    setResult({ size, style });
  }

  function reset() {
    setResult(null);
    setPhotoUrl(null);
  }

  const picks = result ? pickGiftProducts(allProducts, { size: result.size, categories: result.style.categories }) : [];

  return (
    <main className="container">
      <h1>🎁 Подбор подарка</h1>
      <p className="pay-sub">Укажите рост, вес и возраст — подберём размер и стиль из товаров каталога.</p>

      {!result ? (
        <div className="auth-box" style={{ maxWidth: 480 }}>
          <form onSubmit={handleParamsSubmit}>
            <div className="form-row">
              <label className="form-label">Возраст</label>
              <input className="form-input" type="number" min="1" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" />
            </div>
            <div className="form-row form-row-split">
              <div>
                <label className="form-label">Рост, см</label>
                <input className="form-input" type="number" min="100" max="250" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="180" />
              </div>
              <div>
                <label className="form-label">Вес, кг</label>
                <input className="form-input" type="number" min="30" max="250" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" />
              </div>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="btn btn-primary btn-large" style={{ width: '100%', marginTop: 8 }} type="submit">
              Подобрать
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="auth-box" style={{ maxWidth: 480 }}>
            <p className="pay-sub">
              Рекомендуемый размер: <strong>{result.size}</strong> · Стиль: <strong>{result.style.label}</strong>
            </p>
            <div className="form-row">
              <label className="form-label">Фото (необязательно — чтобы примерять товары ниже)</label>
              <label className={`pay-upload-box ${photoUrl ? 'has-file' : ''}`}>
                <span className="pay-upload-icon">📷</span>
                <span>{photoUrl ? '✓ Фото выбрано' : 'Нажмите, чтобы выбрать фото'}</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
              </label>
              {photoUrl ? <img src={photoUrl} alt="" className="form-image-preview" /> : null}
            </div>
            <button className="pay-ghost-btn" type="button" onClick={reset}>
              Подобрать заново
            </button>
          </div>

          <section className="section">
            <div className="section-title"><span>Подходящие товары</span></div>
            {picks.length === 0 ? (
              <p className="pay-sub">Ничего подходящего не нашлось — попробуйте другие параметры.</p>
            ) : (
              <div className="product-grid">
                {picks.map((p) => (
                  <ProductCard key={p.id} product={p} onTryOn={photoUrl ? setTryOnProduct : undefined} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tryOnProduct ? (
        <TryOnModal photoUrl={photoUrl} product={tryOnProduct} onClose={() => setTryOnProduct(null)} />
      ) : null}
    </main>
  );
}
