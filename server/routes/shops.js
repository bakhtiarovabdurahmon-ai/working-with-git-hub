import { Router } from 'express';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateUniqueCode } from '../lib/codes.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const shops = await Shop.find({}).sort({ createdAt: -1 });
  res.json(shops.map((s) => s.toJSON()));
});

router.post('/', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Укажите название магазина' });

  const code = await generateUniqueCode(Shop);
  const shop = await Shop.create({ name, code });
  res.status(201).json(shop.toJSON());
});

// Добавить сотрудника (по его личному ID-коду) в магазин (по коду магазина).
// Если у пользователя ещё роль "покупатель" — повышаем до "продавец", т.к.
// членство в магазине само по себе и есть право продавать.
router.post('/assign', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const { userCode, shopCode } = req.body;
  if (!userCode || !shopCode) return res.status(400).json({ error: 'Укажите ID пользователя и код магазина' });

  const user = await User.findOne({ code: String(userCode).trim() });
  if (!user) return res.status(404).json({ error: 'Пользователь с таким ID не найден' });
  if (user.role === 'admin' || user.role === 'superadmin') {
    return res.status(400).json({ error: 'Администраторов нельзя привязать к магазину' });
  }

  const shop = await Shop.findOne({ code: String(shopCode).trim() });
  if (!shop) return res.status(404).json({ error: 'Магазин с таким кодом не найден' });

  user.shopId = shop._id;
  if (user.role === 'customer') user.role = 'seller';
  await user.save();
  res.json(user.toJSON());
});

export default router;
