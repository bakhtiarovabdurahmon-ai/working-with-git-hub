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
    const priceNum = Number(req.body.price);
    const discountNum = Number(req.body.discount) || 0;
    const qtyNum = Number(req.body.qty) || 0;
    if (!Number.isFinite(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'Некорректная цена' });
    if (discountNum < 0 || discountNum > 90) return res.status(400).json({ error: 'Скидка должна быть от 0 до 90%' });
    if (qtyNum < 0) return res.status(400).json({ error: 'Некорректное количество' });

    const product = await Product.create({
      ...req.body,
      price: priceNum,
      discount: discountNum,
      qty: qtyNum,
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
