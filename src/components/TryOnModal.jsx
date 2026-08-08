import { useState } from 'react';

// Демо-«примерка»: накладывает фото/эмодзи товара поверх фото пользователя
// в примерной точке (по категории), с ручной подстройкой позиции и размера.
// Это не настоящая виртуальная примерка — для неё нужна модель с анализом
// позы человека на фото, которой у этого магазина нет — поэтому здесь
// честно просто наложение картинки, которое пользователь сам подгоняет.

const DEFAULT_ANCHOR = {
  tshirts: { top: 32, width: 42 },
  shirts: { top: 32, width: 44 },
  knitwear: { top: 32, width: 46 },
  outerwear: { top: 34, width: 50 },
  pants: { top: 66, width: 40 },
  shoes: { top: 90, width: 28 },
  underwear: { top: 60, width: 30 },
  accessories: { top: 14, width: 22 },
};

export default function TryOnModal({ photoUrl, product, onClose }) {
  const anchor = DEFAULT_ANCHOR[product.category] || { top: 40, width: 40 };
  const [top, setTop] = useState(anchor.top);
  const [left, setLeft] = useState(50);
  const [scale, setScale] = useState(anchor.width);
  const [opacity, setOpacity] = useState(90);

  return (
    <div className="pay-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pay-modal">
        <button className="pay-close-btn" type="button" onClick={onClose}>✕</button>
        <div className="pay-eyebrow">Примерка (демо)</div>
        <h2 className="pay-title">{product.title}</h2>
        <p className="pay-sub">
          ⚠ Приблизительное наложение фото товара на ваш снимок, не настоящая виртуальная примерка — для этого
          нужна модель с анализом позы, которой здесь нет. Подвиньте ползунки, чтобы примерно совместить.
        </p>

        <div style={{ position: 'relative', width: '100%', maxWidth: 320, margin: '0 auto', borderRadius: 12, overflow: 'hidden', background: '#f4f4f6' }}>
          <img src={photoUrl} alt="" style={{ width: '100%', display: 'block' }} />
          <div
            style={{
              position: 'absolute',
              top: top + '%',
              left: left + '%',
              width: scale + '%',
              transform: 'translate(-50%, -50%)',
              opacity: opacity / 100,
              pointerEvents: 'none',
            }}
          >
            {product.image ? (
              <img src={product.image} alt="" style={{ width: '100%', display: 'block' }} />
            ) : (
              <div style={{ fontSize: 'calc(3px + 2.2vw)', textAlign: 'center', lineHeight: 1 }}>{product.emoji}</div>
            )}
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Выше / ниже</label>
          <input type="range" min="0" max="100" value={top} onChange={(e) => setTop(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div className="form-row">
          <label className="form-label">Левее / правее</label>
          <input type="range" min="0" max="100" value={left} onChange={(e) => setLeft(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div className="form-row">
          <label className="form-label">Размер</label>
          <input type="range" min="10" max="90" value={scale} onChange={(e) => setScale(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div className="form-row">
          <label className="form-label">Прозрачность</label>
          <input type="range" min="30" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
