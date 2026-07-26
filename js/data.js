// Мок-данные каталога товаров (в реальном проекте — запрос к API)

const CATEGORIES = [
  { id: 'women', title: 'Женщинам', icon: '👗' },
  { id: 'men', title: 'Мужчинам', icon: '👔' },
  { id: 'kids', title: 'Детям', icon: '🧸' },
  { id: 'shoes', title: 'Обувь', icon: '👟' },
  { id: 'electronics', title: 'Электроника', icon: '📱' },
  { id: 'home', title: 'Дом', icon: '🏠' },
  { id: 'beauty', title: 'Красота', icon: '💄' },
  { id: 'sport', title: 'Спорт', icon: '⚽' },
];

const ADJECTIVES = ['Стильный', 'Классический', 'Модный', 'Удобный', 'Премиум', 'Базовый', 'Трендовый', 'Практичный'];

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildProducts() {
  const catalog = [
    { title: 'Худи оверсайз', category: 'women', price: 1590, emoji: '🧥', brand: 'URBAN' },
    { title: 'Платье летнее', category: 'women', price: 2390, emoji: '👗', brand: 'LOLA' },
    { title: 'Джинсы прямые', category: 'women', price: 2190, emoji: '👖', brand: 'DENIM' },
    { title: 'Куртка утеплённая', category: 'women', price: 4590, emoji: '🧥', brand: 'WINTER' },
    { title: 'Футболка базовая', category: 'men', price: 890, emoji: '👕', brand: 'BASIC' },
    { title: 'Рубашка офисная', category: 'men', price: 1990, emoji: '👔', brand: 'OFFICE' },
    { title: 'Брюки классические', category: 'men', price: 2490, emoji: '👖', brand: 'CLASSIC' },
    { title: 'Свитер вязаный', category: 'men', price: 2290, emoji: '🧶', brand: 'KNIT' },
    { title: 'Комбинезон детский', category: 'kids', price: 1290, emoji: '🧸', brand: 'BABY' },
    { title: 'Костюм спортивный детский', category: 'kids', price: 1790, emoji: '👶', brand: 'KIDDO' },
    { title: 'Кроссовки беговые', category: 'shoes', price: 3490, emoji: '👟', brand: 'RUN' },
    { title: 'Ботинки зимние', category: 'shoes', price: 4990, emoji: '🥾', brand: 'WARM' },
    { title: 'Туфли на каблуке', category: 'shoes', price: 2990, emoji: '👠', brand: 'ELEGANCE' },
    { title: 'Сандалии летние', category: 'shoes', price: 1490, emoji: '👡', brand: 'SUMMER' },
    { title: 'Смартфон 128GB', category: 'electronics', price: 18990, emoji: '📱', brand: 'TECH' },
    { title: 'Наушники беспроводные', category: 'electronics', price: 2990, emoji: '🎧', brand: 'SOUND' },
    { title: 'Умные часы', category: 'electronics', price: 5990, emoji: '⌚', brand: 'SMART' },
    { title: 'Power bank 10000 mAh', category: 'electronics', price: 1590, emoji: '🔋', brand: 'POWER' },
    { title: 'Постельное бельё сатин', category: 'home', price: 2190, emoji: '🛏️', brand: 'HOME' },
    { title: 'Набор кастрюль', category: 'home', price: 3990, emoji: '🍳', brand: 'COOK' },
    { title: 'Плед флисовый', category: 'home', price: 990, emoji: '🧵', brand: 'COZY' },
    { title: 'Набор кистей для макияжа', category: 'beauty', price: 890, emoji: '💄', brand: 'BEAUTY' },
    { title: 'Крем для лица', category: 'beauty', price: 690, emoji: '🧴', brand: 'SKIN' },
    { title: 'Парфюм унисекс', category: 'beauty', price: 3290, emoji: '🌸', brand: 'AROMA' },
    { title: 'Гантели разборные', category: 'sport', price: 2490, emoji: '🏋️', brand: 'FIT' },
    { title: 'Йога-коврик', category: 'sport', price: 990, emoji: '🧘', brand: 'ZEN' },
    { title: 'Велосипед горный', category: 'sport', price: 24990, emoji: '🚲', brand: 'BIKE' },
    { title: 'Рюкзак спортивный', category: 'sport', price: 1890, emoji: '🎒', brand: 'GO' },
  ];

  return catalog.map((item, i) => {
    const seed = i + 1;
    const hasDiscount = seededRandom(seed) > 0.35;
    const discount = hasDiscount ? Math.round(10 + seededRandom(seed * 2) * 45) : 0;
    const price = item.price;
    const oldPrice = hasDiscount ? Math.round(price / (1 - discount / 100)) : null;
    const rating = Math.round((3.5 + seededRandom(seed * 3) * 1.5) * 10) / 10;
    const reviews = Math.round(5 + seededRandom(seed * 4) * 2000);
    const adjective = ADJECTIVES[i % ADJECTIVES.length];
    return {
      id: 'p' + seed,
      title: `${adjective} ${item.title.toLowerCase()}`,
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
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      inStock: seededRandom(seed * 5) > 0.05,
    };
  });
}

const PRODUCTS = buildProducts();

function getProductById(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function getCategoryTitle(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat ? cat.title : '';
}
