// Мок-данные каталога товаров (в реальном проекте — запрос к API)
// Магазин специализируется только на мужской одежде

export const CATEGORIES = [
  { id: 'tshirts', title: 'Футболки', icon: '👕' },
  { id: 'shirts', title: 'Рубашки', icon: '👔' },
  { id: 'pants', title: 'Брюки и джинсы', icon: '👖' },
  { id: 'outerwear', title: 'Верхняя одежда', icon: '🧥' },
  { id: 'knitwear', title: 'Свитеры и худи', icon: '🧶' },
  { id: 'shoes', title: 'Обувь', icon: '👞' },
  { id: 'underwear', title: 'Бельё и носки', icon: '🧦' },
  { id: 'accessories', title: 'Аксессуары', icon: '🧢' },
];

// Обычные размеры одежды: буквенные до XL, дальше без потолка на 2XL — до 20XL.
function buildGeneralSizes() {
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];
  for (let i = 2; i <= 20; i++) sizes.push(i + 'XL');
  return sizes;
}

export const GENERAL_SIZES = buildGeneralSizes();
// Брюки/джинсы/шорты — числовой размер (обхват талии, см).
export const PANTS_SIZES = ['44', '46', '48', '50', '52', '54', '56', '58', '60', '62'];
// Обувь — числовой размер (EU).
export const SHOE_SIZES = ['39', '40', '41', '42', '43', '44', '45', '46'];

export function sizesForCategory(category) {
  if (category === 'pants') return PANTS_SIZES;
  if (category === 'shoes') return SHOE_SIZES;
  return GENERAL_SIZES;
}

// Каталог наполняют только продавцы через личный кабинет (см. store.jsx,
// AddProductModal.jsx) — витринных товаров-заглушек здесь больше нет,
// сайт готов к публикации без демо-контента.
export const PRODUCTS = [];

export function getProductById(id) {
  return PRODUCTS.find((p) => p.id === id);
}

export function getCategoryTitle(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat ? cat.title : '';
}
