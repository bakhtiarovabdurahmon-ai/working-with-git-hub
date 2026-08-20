import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

function StarPicker({ value, onChange }) {
  return (
    <div>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className="star-picker-btn"
          onClick={() => onChange(i)}
          aria-label={`Оценка ${i} из 5`}
        >
          <span className={`star ${i <= value ? 'filled' : ''}`}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function ReviewsSection({ productId }) {
  const { getReviews, addReview } = useStore();
  const { currentUser } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReviews(productId)
      .then((list) => { if (!cancelled) setReviews(list); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [productId, getReviews]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Напишите текст отзыва');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const created = await addReview(productId, rating, text.trim());
      setReviews((prev) => [created, ...prev]);
      setText('');
      setRating(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="reviews-section">
      <h2>Отзывы {reviews.length > 0 ? `(${reviews.length})` : ''}</h2>

      {currentUser ? (
        <form onSubmit={handleSubmit} className="review-form">
          <StarPicker value={rating} onChange={setRating} />
          <textarea
            className="form-input"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Поделитесь впечатлением о товаре"
          />
          {error ? <div className="form-error">{error}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? 'Отправляем…' : 'Оставить отзыв'}
          </button>
        </form>
      ) : (
        <p className="pay-sub">
          <Link to="/login">Войдите</Link>, чтобы оставить отзыв.
        </p>
      )}

      {loading ? (
        <p className="pay-sub">Загружаем отзывы…</p>
      ) : reviews.length === 0 ? (
        <p className="pay-sub">Отзывов пока нет — станьте первым.</p>
      ) : (
        <div className="review-list">
          {reviews.map((r) => (
            <div className="review-item" key={r.id}>
              <div className="review-item-head">
                <span className="review-author">{r.authorName}</span>
                <span>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`star ${i <= r.rating ? 'filled' : ''}`}>★</span>
                  ))}
                </span>
                <span className="review-date">{formatDate(r.createdAt)}</span>
              </div>
              <p className="review-text">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
