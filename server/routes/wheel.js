import { Router } from 'express';
import WheelPrize from '../models/WheelPrize.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const SPIN_COST = 1000;

router.get('/prizes', requireAuth, async (req, res) => {
  const prizes = await WheelPrize.find({ active: true }).sort({ createdAt: -1 });
  res.json(prizes.map((p) => p.toJSON()));
});

router.post('/prizes', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const label = String(req.body.label || '').trim();
  const type = req.body.type;
  if (!label) return res.status(400).json({ error: 'Укажите название приза' });
  if (!['clothing', 'cashback', 'discount'].includes(type)) return res.status(400).json({ error: 'Некорректный тип приза' });

  const valueNum = Number(req.body.value) || 0;
  if ((type === 'cashback' || type === 'discount') && valueNum <= 0) {
    return res.status(400).json({ error: 'Укажите сумму/процент больше нуля' });
  }

  const prize = await WheelPrize.create({
    label,
    type,
    value: type === 'clothing' ? 0 : valueNum,
    sellerEmail: req.user.email,
    shopId: req.user.shopId || null,
  });
  res.status(201).json(prize.toJSON());
});

router.delete('/prizes/:id', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  const prize = await WheelPrize.findById(req.params.id);
  if (!prize) return res.status(404).json({ error: 'Приз не найден' });
  const isStaff = req.user.role === 'admin' || req.user.role === 'superadmin';
  const sameShop = req.user.shopId && prize.shopId && String(prize.shopId) === String(req.user.shopId);
  if (!isStaff && !sameShop && prize.sellerEmail !== req.user.email) {
    return res.status(403).json({ error: 'Можно удалять только свои призы' });
  }
  await prize.deleteOne();
  res.status(204).end();
});

router.post('/spin', requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user.cashback < SPIN_COST) {
    return res.status(400).json({ error: `Нужно минимум ${SPIN_COST} кешбека, у вас ${user.cashback}` });
  }

  const prizes = await WheelPrize.find({ active: true });
  if (prizes.length === 0) return res.status(400).json({ error: 'Пока нет доступных призов' });

  const prize = prizes[Math.floor(Math.random() * prizes.length)];

  user.cashback -= SPIN_COST;
  if (prize.type === 'cashback') user.cashback += prize.value;
  await user.save();

  res.json({ prize: prize.toJSON(), cashback: user.cashback });
});

export default router;
