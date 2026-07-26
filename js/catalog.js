// Логика страницы каталога: фильтры, сортировка, поиск

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const state = {
    q: params.get('q') || '',
    categories: params.get('category') ? [params.get('category')] : [],
    sort: 'popular',
    minPrice: null,
    maxPrice: null,
  };

  renderHeader(state.q);

  const filtersEl = document.getElementById('category-filters');
  filtersEl.innerHTML = CATEGORIES.map(
    (c) => `
      <label class="filter-checkbox">
        <input type="checkbox" value="${c.id}" ${state.categories.includes(c.id) ? 'checked' : ''} />
        ${c.icon} ${c.title}
      </label>`
  ).join('');

  const sortSelect = document.getElementById('sort-select');
  const minPriceInput = document.getElementById('min-price');
  const maxPriceInput = document.getElementById('max-price');
  const resultsCount = document.getElementById('results-count');
  const pageTitle = document.getElementById('catalog-title');
  const clearBtn = document.getElementById('clear-filters');
  const noResults = document.getElementById('no-results');

  function currentProducts() {
    let list = PRODUCTS.slice();

    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || getCategoryTitle(p.category).toLowerCase().includes(q)
      );
    }

    if (state.categories.length) {
      list = list.filter((p) => state.categories.includes(p.category));
    }

    if (state.minPrice != null) list = list.filter((p) => p.price >= state.minPrice);
    if (state.maxPrice != null) list = list.filter((p) => p.price <= state.maxPrice);

    switch (state.sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'discount':
        list.sort((a, b) => b.discount - a.discount);
        break;
      default:
        list.sort((a, b) => b.reviews - a.reviews);
    }

    return list;
  }

  function render() {
    const list = currentProducts();
    resultsCount.textContent = `${list.length} товаров`;
    pageTitle.textContent = state.q
      ? `Результаты по запросу «${state.q}»`
      : state.categories.length === 1
      ? getCategoryTitle(state.categories[0])
      : 'Все товары';

    grid.innerHTML = list.map(productCardHtml).join('');
    attachProductCardEvents(grid);
    noResults.style.display = list.length === 0 ? 'block' : 'none';
  }

  filtersEl.addEventListener('change', () => {
    state.categories = Array.from(filtersEl.querySelectorAll('input:checked')).map((i) => i.value);
    render();
  });

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    render();
  });

  function applyPrice() {
    const min = parseInt(minPriceInput.value, 10);
    const max = parseInt(maxPriceInput.value, 10);
    state.minPrice = isNaN(min) ? null : min;
    state.maxPrice = isNaN(max) ? null : max;
    render();
  }
  minPriceInput.addEventListener('change', applyPrice);
  maxPriceInput.addEventListener('change', applyPrice);

  clearBtn.addEventListener('click', () => {
    state.categories = [];
    state.minPrice = null;
    state.maxPrice = null;
    state.sort = 'popular';
    minPriceInput.value = '';
    maxPriceInput.value = '';
    sortSelect.value = 'popular';
    filtersEl.querySelectorAll('input').forEach((i) => (i.checked = false));
    render();
  });

  render();
});

function onFavoritesChanged() {}
