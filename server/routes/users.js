import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Admin panel is shared by admin and superadmin — both can see the list.
router.get('/', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const users = await User.find({}).sort({ email: 1 });
  res.json(users.map((u) => u.toJSON()));
});

router.patch('/:email', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase();
  const { role } = req.body;
  if (!['customer', 'seller', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Некорректная роль' });
  }
  if (email === req.user.email) {
    return res.status(400).json({ error: 'Нельзя изменить собственную роль' });
  }
  if (role === 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Назначать администраторов может только супер админ' });
  }
  const target = await User.findOne({ email });
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  if (target.role === 'superadmin') {
    return res.status(403).json({ error: 'Нельзя изменить роль супер админа' });
  }
  if (target.role === 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Изменять роль администратора может только супер админ' });
  }
  target.role = role;
  await target.save();
  res.json(target.toJSON());
});

// Продавец сам закрывает/открывает свою личную смену — пока закрыта, заказы
// на его сток не маршрутизируются (см. server/routes/orders.js).
router.patch('/me/shift', requireAuth, requireRole('seller', 'admin', 'superadmin'), async (req, res) => {
  req.user.onShift = !!req.body.onShift;
  await req.user.save();
  res.json(req.user.toJSON());
});

// Superadmin promotes someone to admin by their ID code instead of hunting
// them down in the table.
router.post('/promote-by-code', requireAuth, requireRole('superadmin'), async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Укажите ID-код' });
  const user = await User.findOne({ code });
  if (!user) return res.status(404).json({ error: 'Пользователь с таким ID не найден' });
  user.role = 'admin';
  await user.save();
  res.json(user.toJSON());
});

export default router;
