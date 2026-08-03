// Мок-данные каталога товаров (в реальном проекте — запрос к API)
// Магазин специализируется только на мужской одежде

export const CATEGORIES = [
  { id: 'tshirts', title: 'Футболки и поло', icon: '👕' },
  { id: 'shirts', title: 'Рубашки', icon: '👔' },
  { id: 'pants', title: 'Брюки и джинсы', icon: '👖' },
  { id: 'outerwear', title: 'Верхняя одежда', icon: '🧥' },
  { id: 'knitwear', title: 'Свитеры и худи', icon: '🧶' },
  { id: 'shoes', title: 'Обувь', icon: '👞' },
  { id: 'underwear', title: 'Бельё и носки', icon: '🧦' },
  { id: 'accessories', title: 'Аксессуары', icon: '🧢' },
];

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildProducts() {
  const catalog = [
    { title: 'Футболка базовая', category: 'tshirts', price: 890, emoji: '👕', brand: 'BASIC' },
    { title: 'Футболка с принтом', category: 'tshirts', price: 1190, emoji: '👕', brand: 'URBAN' },
    { title: 'Поло пике', category: 'tshirts', price: 1690, emoji: '👕', brand: 'CLASSIC' },
    { title: 'Лонгслив хлопковый', category: 'tshirts', price: 1290, emoji: '👕', brand: 'BASIC' },
    { title: 'Рубашка офисная', category: 'shirts', price: 1990, emoji: '👔', brand: 'OFFICE' },
    { title: 'Рубашка в клетку', category: 'shirts', price: 2190, emoji: '👔', brand: 'CHECK' },
    { title: 'Рубашка льняная', category: 'shirts', price: 2490, emoji: '👔', brand: 'LINEN' },
    { title: 'Рубашка джинсовая', category: 'shirts', price: 2390, emoji: '👔', brand: 'DENIM' },
    { title: 'Брюки классические', category: 'pants', price: 2490, emoji: '👖', brand: 'CLASSIC' },
    { title: 'Джинсы прямые', category: 'pants', price: 2990, emoji: '👖', brand: 'DENIM' },
    { title: 'Джинсы зауженные', category: 'pants', price: 3190, emoji: '👖', brand: 'SLIM' },
    { title: 'Брюки чинос', category: 'pants', price: 2290, emoji: '👖', brand: 'CHINO' },
    { title: 'Шорты карго', category: 'pants', price: 1790, emoji: '🩳', brand: 'CARGO' },
    { title: 'Куртка утеплённая', category: 'outerwear', price: 4590, emoji: '🧥', brand: 'WINTER' },
    { title: 'Пуховик зимний', category: 'outerwear', price: 6990, emoji: '🧥', brand: 'WARM' },
    { title: 'Ветровка лёгкая', category: 'outerwear', price: 3290, emoji: '🧥', brand: 'WIND' },
    { title: 'Бомбер', category: 'outerwear', price: 3990, emoji: '🧥', brand: 'BOMBER' },
    { title: 'Пальто шерстяное', category: 'outerwear', price: 7990, emoji: '🧥', brand: 'WOOL' },
    { title: 'Свитер вязаный', category: 'knitwear', price: 2290, emoji: '🧶', brand: 'KNIT' },
    { title: 'Худи оверсайз', category: 'knitwear', price: 2590, emoji: '🧶', brand: 'URBAN' },
    { title: 'Кардиган на молнии', category: 'knitwear', price: 2790, emoji: '🧶', brand: 'ZIP' },
    { title: 'Толстовка с капюшоном', category: 'knitwear', price: 2390, emoji: '🧶', brand: 'HOOD' },
    { title: 'Кроссовки беговые', category: 'shoes', price: 3490, emoji: '👟', brand: 'RUN' },
    { title: 'Ботинки зимние', category: 'shoes', price: 4990, emoji: '🥾', brand: 'WARM' },
    { title: 'Туфли классические', category: 'shoes', price: 4290, emoji: '👞', brand: 'ELEGANCE' },
    { title: 'Кеды повседневные', category: 'shoes', price: 2490, emoji: '👟', brand: 'CASUAL' },
    { title: 'Носки хлопковые (набор 5 пар)', category: 'underwear', price: 590, emoji: '🧦', brand: 'BASIC' },
    { title: 'Боксеры хлопковые (набор 3 шт)', category: 'underwear', price: 990, emoji: '🩲', brand: 'COMFORT' },
    { title: 'Термобельё комплект', category: 'underwear', price: 1890, emoji: '🧦', brand: 'THERMO' },
    { title: 'Ремень кожаный', category: 'accessories', price: 1490, emoji: '👞', brand: 'LEATHER' },
    { title: 'Кепка бейсболка', category: 'accessories', price: 890, emoji: '🧢', brand: 'CAP' },
    { title: 'Рюкзак городской', category: 'accessories', price: 2790, emoji: '🎒', brand: 'GO' },
    { title: 'Часы наручные', category: 'accessories', price: 5990, emoji: '⌚', brand: 'TIME' },
  ];

  return catalog.map((item, i) => {
    const seed = i + 1;
    const hasDiscount = seededRandom(seed) > 0.35;
    const discount = hasDiscount ? Math.round(10 + seededRandom(seed * 2) * 45) : 0;
    const price = item.price;
    const oldPrice = hasDiscount ? Math.round(price / (1 - discount / 100)) : null;
    const rating = Math.round((3.5 + seededRandom(seed * 3) * 1.5) * 10) / 10;
    const reviews = Math.round(5 + seededRandom(seed * 4) * 2000);
    return {
      id: 'p' + seed,
      title: item.title,
      category: item.category,
      brand: item.brand,
      price,
      oldPrice,
      discount,
      rating,
      reviews,
      emoji: item.emoji,
      color: `hsl(${(seed * 47) % 360}, 70%, 92%)`,
      description: `${item.title} от бренда ${item.brand}. Качественные материалы, аккуратный пошив и продуманный крой. Отлично подойдёт на каждый день и для особых случаев. Уточняйте наличие размеров и цветов у продавца.`,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      inStock: seededRandom(seed * 5) > 0.05,
    };
  });
}

export const PRODUCTS = buildProducts();

export function getProductById(id) {
  return PRODUCTS.find((p) => p.id === id);
}

export function getCategoryTitle(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat ? cat.title : '';
}
