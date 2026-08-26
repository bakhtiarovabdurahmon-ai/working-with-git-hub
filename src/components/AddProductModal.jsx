import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, sizesForCategory } from '../data.js';
import { useStore, formatPrice } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import PhotoEditor from './PhotoEditor.jsx';

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

// Общий пикер "размер -> количество" — используется и для новой карточки, и
// для присоединения своего стока к чужой. sizeQty: { [size]: qtyString }.
function SizeQtyPicker({ availableSizes, sizeQty, onChange }) {
  function toggleSize(s) {
    onChange((prev) => {
      const next = { ...prev };
      if (s in next) delete next[s];
      else next[s] = '1';
      return next;
    });
  }
  function setQty(s, value) {
    onChange((prev) => ({ ...prev, [s]: value }));
  }

  return (
    <div className="form-row">
      <label className="form-label">Размеры и количество на складе</label>
      <div className="size-options">
        {availableSizes.map((s) => (
          <button
            key={s}
            type="button"
            className={`size-option ${s in sizeQty ? 'selected' : ''}`}
            onClick={() => toggleSize(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {Object.keys(sizeQty).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {Object.keys(sizeQty).map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 40 }}>{s}</span>
              <input
                className="form-input"
                type="number"
                min="0"
                style={{ width: 100 }}
                value={sizeQty[s]}
                onChange={(e) => setQty(s, e.target.value)}
              />
              <span className="pay-sub">шт.</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AddProductModal({ onClose }) {
  const { addProduct, joinStock, serverMode } = useStore();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [sizeQty, setSizeQty] = useState({});
  const [description, setDescription] = useState('');
  const [imagesData, setImagesData] = useState([]);
  const [imageError, setImageError] = useState(null);
  const [editingSrc, setEditingSrc] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchResults, setSearchResults] = useState([]);
  const [joinedProduct, setJoinedProduct] = useState(null);
  const searchTimer = useRef(null);

  const availableSizes = sizesForCategory(category);

  function handleCategoryChange(next) {
    setCategory(next);
    setSizeQty({});
  }

  // Ищем похожие товары по названию, пока печатает — чтобы не плодить
  // дубликаты одной и той же вещи от разных продавцов.
  useEffect(() => {
    if (!serverMode || joinedProduct) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchTimer.current);
    const q = title.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setSearchResults(await api.searchProducts(q));
      } catch (e) {
        setSearchResults([]);
      }
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [title, serverMode, joinedProduct]);

  async function handleImageChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // позволяет выбрать тот же файл ещё раз (например, сфотографировать снова)
    if (!file) return;
    setImageError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setEditingSrc(dataUrl); // открываем редактор — обрезать/повернуть/поправить свет перед добавлением
    } catch (err) {
      setImageError(err.message);
    }
  }

  function removeImage(idx) {
    setImagesData((prev) => prev.filter((_, i) => i !== idx));
  }

  function buildSizesPayload() {
    const sizes = [];
    for (const [size, qtyStr] of Object.entries(sizeQty)) {
      const qty = parseInt(qtyStr, 10);
      if (!Number.isFinite(qty) || qty < 0) return null;
      sizes.push({ size, qty });
    }
    return sizes;
  }

  async function handleSubmitNew(e) {
    e.preventDefault();
    setError(null);

    const priceNum = parseInt(price, 10);
    const discountNum = discount ? parseInt(discount, 10) : 0;
    const sizes = buildSizesPayload();

    if (!title.trim()) return setError('Укажите название товара');
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError('Укажите корректную цену');
    if (discount && (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 90)) return setError('Скидка должна быть от 0 до 90%');
    if (!sizes || sizes.length === 0) return setError('Выберите хотя бы один размер и укажите количество');

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
        emoji: imagesData.length ? null : '🛍️',
        image: imagesData[0] || null,
        images: imagesData,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 92%)`,
        description: description.trim() || `${title.trim()}. Добавлено продавцом.`,
        sizes,
        sellerEmail: currentUser?.email || null,
        shopId: currentUser?.shopId || null,
      });
      setDone(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitJoin(e) {
    e.preventDefault();
    setError(null);
    const sizes = buildSizesPayload();
    if (!sizes || sizes.length === 0) return setError('Укажите хотя бы один размер и количество');

    setSaving(true);
    try {
      await joinStock(joinedProduct.id, sizes);
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
        <div className="pay-eyebrow">{joinedProduct ? 'Присоединиться к товару' : 'Новый товар'}</div>
        <h2 className="pay-title">{joinedProduct ? joinedProduct.title : 'Добавить товар'}</h2>
        <span className="pay-demo-flag">{serverMode ? '🟢 Сохранится на сервере, видно всем' : '🟡 Автономный режим: только в этом браузере'}</span>

        {done ? (
          <div className="pay-status-text" style={{ textAlign: 'left', color: 'var(--success)' }}>✓ Готово</div>
        ) : joinedProduct ? (
          <form onSubmit={handleSubmitJoin}>
            <p className="pay-sub">
              Это уже существующая карточка (цена {formatPrice(joinedProduct.price)}). Вы добавляете свой сток —
              покупатели увидят один общий товар, а заказ уйдёт вам, если у вас есть нужный размер и вы на смене.
            </p>
            <SizeQtyPicker availableSizes={sizesForCategory(joinedProduct.category)} sizeQty={sizeQty} onChange={setSizeQty} />
            {error ? <div className="form-error">{error}</div> : null}
            <button className="btn btn-primary btn-large" style={{ width: '100%', marginTop: 8 }} type="submit" disabled={saving}>
              {saving ? 'Сохраняем…' : 'Добавить мой сток'}
            </button>
            <button
              className="pay-ghost-btn"
              type="button"
              onClick={() => {
                setJoinedProduct(null);
                setSizeQty({});
                setError(null);
              }}
            >
              Это другой товар — создать новую карточку
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitNew}>
            <div className="form-row">
              <label className="form-label">Название</label>
              <input className="form-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Куртка утеплённая" />
              {searchResults.length > 0 ? (
                <div className="admin-table-wrap" style={{ marginTop: 8 }}>
                  <p className="pay-sub">Похожие товары уже есть в каталоге — если это тот же товар, присоединитесь вместо создания дубля:</p>
                  {searchResults.map((p) => {
                    const totalQty = Object.values(p.sizeStock || {}).reduce((sum, q) => sum + q, 0);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="pay-ghost-btn"
                        style={{ display: 'block', width: '100%', textAlign: 'left' }}
                        onClick={() => {
                          setJoinedProduct(p);
                          setSizeQty({});
                          setSearchResults([]);
                        }}
                      >
                        {p.title} — {formatPrice(p.price)} · {totalQty} шт{p.archived ? ' · распродано' : ''}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="form-row">
              <label className="form-label">Категория</label>
              <select className="form-input" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
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

            <SizeQtyPicker availableSizes={availableSizes} sizeQty={sizeQty} onChange={setSizeQty} />

            <div className="form-row">
              <label className="form-label">Фото товара (необязательно, без ограничений)</label>
              <div className="image-picker-grid">
                {imagesData.map((src, i) => (
                  <div className="image-picker-thumb" key={i}>
                    <img src={src} alt="" />
                    <button type="button" className="image-picker-remove" onClick={() => removeImage(i)} aria-label="Убрать фото">
                      ✕
                    </button>
                  </div>
                ))}
                <label className="pay-upload-box has-file image-picker-add">
                  <span className="pay-upload-icon">📷</span>
                  <span>{imagesData.length > 0 ? `Добавить ещё (${imagesData.length})` : 'Добавить фото'}</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                </label>
              </div>
              <p className="pay-sub">Сфотографируйте товар с разных ракурсов — все фото увидят покупатели на странице товара.</p>
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
      {editingSrc ? (
        <PhotoEditor
          src={editingSrc}
          onCancel={() => setEditingSrc(null)}
          onDone={(finalUrl) => {
            setImagesData((prev) => [...prev, finalUrl]);
            setEditingSrc(null);
          }}
        />
      ) : null}
    </div>
  );
}
