// Логика страницы избранного

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('favorites-grid');
  if (!grid) return;

  function render() {
    const favIds = Object.keys(getFavorites());
    const products = favIds.map(getProductById).filter(Boolean);
    const empty = document.getElementById('favorites-empty');

    if (products.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = products.map(productCardHtml).join('');
    attachProductCardEvents(grid);
  }

  window.onFavoritesChanged = render;
  render();
});
