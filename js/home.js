// Логика главной страницы

document.addEventListener('DOMContentLoaded', () => {
  const catGrid = document.getElementById('home-categories');
  if (catGrid) {
    catGrid.innerHTML = CATEGORIES.map(
      (c) => `<a class="cat-tile" href="catalog.html?category=${c.id}"><span class="cat-tile-icon">${c.icon}</span>${c.title}</a>`
    ).join('');
  }

  const dealsGrid = document.getElementById('home-deals');
  if (dealsGrid) {
    const deals = PRODUCTS.filter((p) => p.discount >= 20).slice(0, 8);
    dealsGrid.innerHTML = deals.map(productCardHtml).join('');
    attachProductCardEvents(dealsGrid);
  }

  const popularGrid = document.getElementById('home-popular');
  if (popularGrid) {
    const popular = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 8);
    popularGrid.innerHTML = popular.map(productCardHtml).join('');
    attachProductCardEvents(popularGrid);
  }
});
