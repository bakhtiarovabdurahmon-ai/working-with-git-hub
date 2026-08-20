import { Router } from 'express';
import Product from '../models/Product.js';
import ProductStock from '../models/ProductStock.js';
import Review from '../models/Review.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateUniqueCode } from '../lib/codes.js';
import { refreshArchiveStatus } from '../lib/archive.js';

const router = Router();

// Собирает карточки товаров + агрегированный сток по каждой (сумма qty по
// размеру среди ВСЕХ магазинов, которые стоят за этой карточкой) — именно
// это покупатель видит как "размер есть/нет", не зная, у кого конкретно.
async function attachAggregatedStock(products) {
  const ids = products.map((p) => p._id);
  const stocks = await ProductStock.find({ productId: { $in: ids }, active: true });
  const bySizeByProduct = new Map();
  for (const stock of stocks) {
    const key = String(stock.productId);
    const sizeMap = bySizeByProduct.get(key) || new Map();
    for (const s of stock.sizes) {
      sizeMap.set(s.size, (sizeMap.get(s.size) || 0) + s.qty);
    }
    bySizeByProduct.set(key, sizeMap);
  }
  return products.map((p) => {
    const json = p.toJSON();
    const sizeMap = bySizeByProduct.get(String(p._id)) || new Map();
    const sizeStock = Object.fromEntries(sizeMap);
    json.sizeStock = sizeStock;
    json.inStock = Object.values(sizeStock).some((qty) => qty > 0);
    return json;
  });
}

router.get('/', async (req, res) => {
  // archived (полностью распродано у всех магазинов) не показываем в
  // каталоге — но карточка остаётся в базе, её видно через /search.
  const products = await Product.find({ archived: { $ne: true } }).sort({ createdAt: -1 });
  res.json(await attachAggregatedStock(products));
});

// Поиск существующих карточек по названию — продавец использует это, чтобы
// присоединить свой сток к уже существующему товару, а не плодить дубликаты
// одной и той же вещи с разными карточками.
router.get('/search', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const products = await Product.find({ title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })
    .sort({ createdAt: -1 })
    .limit(10);
  res.json(await attachAggregatedStock(products));
});

// Все стоковые строки текущего продавца — чтобы он видел и мог редактировать
// свои остатки по каждой карточке, которую он завёл сам или присоединился к чужой.
router.get('/stock/mine', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const stocks = await ProductStock.find({ sellerEmail: req.user.email }).sort({ createdAt: -1 });
  const productIds = stocks.map((s) => s.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productById = new Map(products.map((p) => [String(p._id), p.toJSON()]));
  res.json(
    stocks.map((s) => ({
      ...s.toJSON(),
      product: productById.get(String(s.productId)) || null,
    }))
  );
});

// Все стоковые строки — для админ-панели (кто что продаёт и сколько).
router.get('/stock', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const stocks = await ProductStock.find({}).sort({ createdAt: -1 });
  const productIds = stocks.map((s) => s.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productById = new Map(products.map((p) => [String(p._id), p.toJSON()]));
  res.json(
    stocks.map((s) => ({
      ...s.toJSON(),
      product: productById.get(String(s.productId)) || null,
    }))
  );
});

function parseSizes(input) {
  if (!Array.isArray(input)) return null;
  const sizes = [];
  for (const row of input) {
    const size = String(row?.size || '').trim();
    const qty = Number(row?.qty);
    if (!size || !Number.isFinite(qty) || qty < 0) return null;
    sizes.push({ size, qty });
  }
  return sizes;
}

const MAX_PRODUCT_IMAGES = 4;

// До 4 фото на карточку — продавец фотографирует товар с разных ракурсов.
// Каждая картинка уже уменьшена и сжата на клиенте (см. resizeImageToDataUrl
// в AddProductModal.jsx), так что здесь просто ограничиваем количество и
// подстраховываемся на случай подделанного запроса без ресайза.
function parseImages(input) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  if (input.length > MAX_PRODUCT_IMAGES) return null;
  for (const img of input) {
    if (typeof img !== 'string' || !img.startsWith('data:image/') || img.length > 2_000_000) return null;
  }
  return input;
}

// Новая карточка товара + первая стоковая строка (тот, кто создаёт —
// первый продавец на ней).
router.post('/', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const category = String(req.body.category || '').trim();
    const priceNum = Number(req.body.price);
    const discountNum = Number(req.body.discount) || 0;
    const sizes = parseSizes(req.body.sizes);
    if (!title) return res.status(400).json({ error: 'Укажите название товара' });
    if (!category) return res.status(400).json({ error: 'Укажите категорию' });
    if (!Number.isFinite(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'Некорректная цена' });
    if (discountNum < 0 || discountNum > 90) return res.status(400).json({ error: 'Скидка должна быть от 0 до 90%' });
    if (!sizes || sizes.length === 0) return res.status(400).json({ error: 'Укажите хотя бы один размер и количество' });

    const images = parseImages(req.body.images);
    if (images === null) return res.status(400).json({ error: `Можно приложить не больше ${MAX_PRODUCT_IMAGES} фото` });
    const cover = images[0] || (typeof req.body.image === 'string' ? req.body.image : null);

    const oldPrice = discountNum > 0 ? Math.round(priceNum / (1 - discountNum / 100)) : null;
    const product = await Product.create({
      title,
      category,
      brand: req.body.brand ? String(req.body.brand).trim() : undefined,
      price: priceNum,
      oldPrice,
      discount: discountNum,
      emoji: cover ? null : req.body.emoji || '🛍️',
      image: cover,
      images,
      color: typeof req.body.color === 'string' ? req.body.color : undefined,
      description: req.body.description ? String(req.body.description).trim() : '',
      sizes: sizes.map((s) => s.size),
    });

    const code = await generateUniqueCode(ProductStock);
    await ProductStock.create({
      productId: product._id,
      sellerEmail: req.user.email,
      shopId: req.user.shopId || null,
      code,
      sizes,
    });
    await refreshArchiveStatus(product._id);

    const [withStock] = await attachAggregatedStock([product]);
    res.status(201).json(withStock);
  } catch (err) {
    res.status(400).json({ error: 'Не удалось сохранить товар' });
  }
});

// Присоединить свой сток к уже существующей карточке (другой магазин тоже
// продаёт тот же товар) — карточка остаётся одна, покупатель видит один товар.
router.post('/:id/stock', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const sizes = parseSizes(req.body.sizes);
  if (!sizes || sizes.length === 0) return res.status(400).json({ error: 'Укажите хотя бы один размер и количество' });

  const already = await ProductStock.findOne({ productId: product._id, sellerEmail: req.user.email });
  if (already) return res.status(400).json({ error: 'У вас уже есть сток по этому товару — отредактируйте его вместо создания нового' });

  const code = await generateUniqueCode(ProductStock);
  const stock = await ProductStock.create({
    productId: product._id,
    sellerEmail: req.user.email,
    shopId: req.user.shopId || null,
    code,
    sizes,
  });

  const newSizes = sizes.map((s) => s.size).filter((s) => !product.sizes.includes(s));
  if (newSizes.length > 0) {
    product.sizes = [...product.sizes, ...newSizes];
    await product.save();
  }
  await refreshArchiveStatus(product._id);

  res.status(201).json(stock.toJSON());
});

function canManageStock(user, stock) {
  if (user.role === 'admin' || user.role === 'superadmin') return true;
  if (user.shopId && stock.shopId && String(stock.shopId) === String(user.shopId)) return true;
  return stock.sellerEmail === user.email;
}

// Обновить свои остатки по размерам (пополнение склада).
router.patch('/stock/:stockId', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const stock = await ProductStock.findById(req.params.stockId);
  if (!stock) return res.status(404).json({ error: 'Сток не найден' });
  if (!canManageStock(req.user, stock)) return res.status(403).json({ error: 'Можно менять только свой сток' });

  const sizes = parseSizes(req.body.sizes);
  if (!sizes || sizes.length === 0) return res.status(400).json({ error: 'Укажите хотя бы один размер и количество' });
  stock.sizes = sizes;
  await stock.save();

  const product = await Product.findById(stock.productId);
  if (product) {
    const newSizes = sizes.map((s) => s.size).filter((s) => !product.sizes.includes(s));
    if (newSizes.length > 0) {
      product.sizes = [...product.sizes, ...newSizes];
      await product.save();
    }
  }
  await refreshArchiveStatus(stock.productId);

  res.json(stock.toJSON());
});

// Разовая продажа "вживую" (не через сайт) — продавец на странице своего
// товара выбирает размер и жмёт "Продали", остаток по этому размеру сразу
// уменьшается на 1. Когда весь сток по карточке заканчивается, она
// автоматически прячется из каталога (см. refreshArchiveStatus).
router.patch('/stock/:stockId/sell', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const stock = await ProductStock.findById(req.params.stockId);
  if (!stock) return res.status(404).json({ error: 'Сток не найден' });
  if (!canManageStock(req.user, stock)) return res.status(403).json({ error: 'Можно продавать только свой товар' });

  const size = String(req.body.size || '').trim();
  const row = stock.sizes.find((s) => s.size === size);
  if (!row || row.qty <= 0) return res.status(400).json({ error: 'Этого размера уже нет в наличии' });

  row.qty -= 1;
  await stock.save();
  await refreshArchiveStatus(stock.productId);

  res.json(stock.toJSON());
});

// Удалить свой сток (карточка остаётся, если её продают другие магазины).
router.delete('/stock/:stockId', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const stock = await ProductStock.findById(req.params.stockId);
  if (!stock) return res.status(404).json({ error: 'Сток не найден' });
  if (!canManageStock(req.user, stock)) return res.status(403).json({ error: 'Можно удалять только свой сток' });
  await stock.deleteOne();
  await refreshArchiveStatus(stock.productId);
  res.status(204).end();
});

// Отзывы видит любой посетитель сайта, даже без входа.
router.get('/:id/reviews', async (req, res) => {
  const reviews = await Review.find({ productId: req.params.id }).sort({ createdAt: -1 });
  res.json(reviews.map((r) => r.toJSON()));
});

// Написать отзыв может любой авторизованный пользователь. Рейтинг и
// количество отзывов на карточке товара пересчитываются сразу же.
router.post('/:id/reviews', requireAuth, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const rating = Number(req.body.rating);
  const text = String(req.body.text || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
  }
  if (!text) return res.status(400).json({ error: 'Напишите текст отзыва' });
  if (text.length > 1000) return res.status(400).json({ error: 'Отзыв слишком длинный' });

  const review = await Review.create({
    productId: product._id,
    authorEmail: req.user.email,
    authorName: req.user.name || req.user.email,
    rating,
    text,
  });

  const allReviews = await Review.find({ productId: product._id });
  product.reviews = allReviews.length;
  product.rating = Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10;
  await product.save();

  res.status(201).json(review.toJSON());
});

export default router;
