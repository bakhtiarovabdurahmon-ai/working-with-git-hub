import { useState } from 'react';
import { CATEGORIES, SIZES } from '../data.js';
import { useStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';

const MAX_IMAGE_SIDE = 640;

function resizeImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function AddProductModal({ onClose }) {
  const { addProduct, serverMode } = useStore();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [qty, setQty] = useState('1');
  const [sizes, setSizes] = useState([]);
  const [description, setDescription] = useState('');
  const [imageData, setImageData] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggleSize(s) {
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleImageChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImageError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImageData(dataUrl);
    } catch (err) {
      setImageError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const priceNum = parseInt(price, 10);
    const discountNum = discount ? parseInt(discount, 10) : 0;
    const qtyNum = parseInt(qty, 10);

    if (!title.trim()) return setError('Укажите название товара');
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError('Укажите корректную цену');
    if (discount && (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 90)) return setError('Скидка должна быть от 0 до 90%');
    if (!Number.isFinite(qtyNum) || qtyNum < 0) return setError('Укажите корректное количество');
    if (sizes.length === 0) return setError('Выберите хотя бы один размер');

    const oldPrice = discountNum > 0 ? Math.round(priceNum / (1 - discountNum / 100)) : null;

    setSaving(true);
    try {
      await addProduct({
        title: title.trim(),
        category,
        brand: currentUser?.name || 'Продавец',
        price: priceNum,
        oldPrice,
        discount: discountNum,
        rating: 5,
        reviews: 0,
        emoji: imageData ? null : '🛍️',
        image: imageData,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 92%)`,
        description: description.trim() || `${title.trim()}. Добавлено продавцом.`,
        sizes,
        qty: qtyNum,
        inStock: qtyNum > 0,
        sellerEmail: currentUser?.email || null,
      });
      setDone(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pay-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pay-modal">
        <button className="pay-close-btn" type="button" onClick={onClose}>✕</button>
        <div className="pay-eyebrow">Новый товар</div>
        <h2 className="pay-title">Добавить товар</h2>
        <span className="pay-demo-flag">{serverMode ? '🟢 Сохранится на сервере, видно всем' : '🟡 Автономный режим: только в этом браузере'}</span>

        {done ? (
          <div className="pay-status-text" style={{ textAlign: 'left', color: 'var(--success)' }}>✓ Товар добавлен в каталог</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">Название</label>
              <input className="form-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Куртка утеплённая" />
            </div>

            <div className="form-row">
              <label className="form-label">Категория</label>
              <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
                ))}
              </select>
            </div>

            <div className="form-row form-row-split">
              <div>
                <label className="form-label">Цена, сом</label>
                <input className="form-input" type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2990" />
              </div>
              <div>
                <label className="form-label">Скидка, % (необязательно)</label>
                <input className="form-input" type="number" min="0" max="90" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Количество на складе</label>
              <input className="form-input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" />
            </div>

            <div className="form-row">
              <label className="form-label">Размеры</label>
              <div className="size-options">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`size-option ${sizes.includes(s) ? 'selected' : ''}`}
                    onClick={() => toggleSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Фото товара (необязательно)</label>
              <label className="pay-upload-box has-file">
                <span className="pay-upload-icon">📷</span>
                <span>{imageData ? '✓ Фото выбрано' : 'Нажмите, чтобы выбрать фото'}</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
              </label>
              {imageData ? <img src={imageData} alt="" className="form-image-preview" /> : null}
              {imageError ? <div className="form-error">{imageError}</div> : null}
            </div>

            <div className="form-row">
              <label className="form-label">Описание (необязательно)</label>
              <textarea className="form-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <button className="btn btn-primary btn-large" style={{ width: '100%', marginTop: 8 }} type="submit" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Добавить товар'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
