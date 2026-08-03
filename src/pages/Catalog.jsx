import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, getCategoryTitle } from '../data.js';
import { useStore } from '../store.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Catalog() {
  const { allProducts } = useStore();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category');

  const [categories, setCategories] = useState(initialCategory ? [initialCategory] : []);
  const [sort, setSort] = useState('popular');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  function toggleCategory(id) {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function clearFilters() {
    setCategories([]);
    setMinPrice('');
    setMaxPrice('');
    setSort('popular');
  }

  const list = useMemo(() => {
    let result = allProducts.slice();

    if (q) {
      const ql = q.toLowerCase();
      result = result.filter(
        (p) => p.title.toLowerCase().includes(ql) || p.brand.toLowerCase().includes(ql) || getCategoryTitle(p.category).toLowerCase().includes(ql)
      );
    }

    if (categories.length) {
      result = result.filter((p) => categories.includes(p.category));
    }

    const min = parseInt(minPrice, 10);
    const max = parseInt(maxPrice, 10);
    if (!Number.isNaN(min)) result = result.filter((p) => p.price >= min);
    if (!Number.isNaN(max)) result = result.filter((p) => p.price <= max);

    switch (sort) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'discount':
        result.sort((a, b) => b.discount - a.discount);
        break;
      default:
        result.sort((a, b) => b.reviews - a.reviews);
    }

    return result;
  }, [allProducts, q, categories, sort, minPrice, maxPrice]);

  const title = q ? `Результаты по запросу «${q}»` : categories.length === 1 ? getCategoryTitle(categories[0]) : 'Все товары';

  return (
    <main className="container">
      <div className="catalog-layout">
        <aside className="filters-panel">
          <h3>Категории</h3>
          <div>
            {CATEGORIES.map((c) => (
              <label className="filter-checkbox" key={c.id}>
                <input type="checkbox" checked={categories.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                {c.icon} {c.title}
              </label>
            ))}
          </div>

          <h3>Цена, ₽</h3>
          <div className="price-range">
            <input type="number" placeholder="от" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            <input type="number" placeholder="до" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>

          <button className="btn btn-outline" style={{ width: '100%' }} onClick={clearFilters} type="button">
            Сбросить фильтры
          </button>
        </aside>

        <section>
          <div className="catalog-toolbar">
            <div>
              <h1 id="catalog-title">{title}</h1>
              <span id="results-count">{list.length} товаров</span>
            </div>
            <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="popular">По популярности</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
              <option value="rating">По рейтингу</option>
              <option value="discount">По размеру скидки</option>
            </select>
          </div>

          <div className="product-grid">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {list.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-emoji">🔍</span>
              <h2>Ничего не найдено</h2>
              <p>Попробуйте изменить фильтры или поисковый запрос.</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
