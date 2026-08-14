import { Router } from 'express';
import Product from '../models/Product.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  const products = await Product.find({}).sort({ createdAt: -1 });
  res.json(products.map((p) => p.toJSON()));
});

router.post('/', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const category = String(req.body.category || '').trim();
    const priceNum = Number(req.body.price);
    const discountNum = Number(req.body.discount) || 0;
    const qtyNum = Number(req.body.qty) || 0;
    if (!title) return res.status(400).json({ error: 'Укажите название товара' });
    if (!category) return res.status(400).json({ error: 'Укажите категорию' });
    if (!Number.isFinite(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'Некорректная цена' });
    if (discountNum < 0 || discountNum > 90) return res.status(400).json({ error: 'Скидка должна быть от 0 до 90%' });
    if (qtyNum < 0) return res.status(400).json({ error: 'Некорректное количество' });

    // Whitelisted fields only — never spread req.body directly into
    // Product.create, since that would let a raw API call set things like
    // rating/reviews (fake social proof) or an oldPrice unrelated to the
    // real discount (a fake strike-through price).
    const oldPrice = discountNum > 0 ? Math.round(priceNum / (1 - discountNum / 100)) : null;
    const product = await Product.create({
      title,
      category,
      brand: req.body.brand ? String(req.body.brand).trim() : undefined,
      price: priceNum,
      oldPrice,
      discount: discountNum,
      emoji: typeof req.body.image === 'string' && req.body.image ? null : req.body.emoji || '🛍️',
      image: typeof req.body.image === 'string' ? req.body.image : null,
      color: typeof req.body.color === 'string' ? req.body.color : undefined,
      description: req.body.description ? String(req.body.description).trim() : '',
      sizes: Array.isArray(req.body.sizes) ? req.body.sizes.map(String) : [],
      qty: qtyNum,
      inStock: qtyNum > 0,
      // The seller (and their shop) is whoever is authenticated, never a
      // client-supplied value.
      sellerEmail: req.user.email,
      shopId: req.user.shopId || null,
    });
    res.status(201).json(product.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Не удалось сохранить товар' });
  }
});

router.delete('/:id', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });
  const isStaff = req.user.role === 'admin' || req.user.role === 'superadmin';
  const sameShop = req.user.shopId && product.shopId && String(product.shopId) === String(req.user.shopId);
  if (!isStaff && !sameShop && product.sellerEmail !== req.user.email) {
    return res.status(403).json({ error: 'Можно удалять только товары своего магазина' });
  }
  await product.deleteOne();
  res.status(204).end();
});

export default router;
