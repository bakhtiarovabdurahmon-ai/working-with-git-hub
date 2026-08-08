import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Only admins can see the full account list (used by the admin panel).
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await User.find({}).sort({ email: 1 });
  res.json(users.map((u) => u.toJSON()));
});

router.patch('/:email', requireAuth, requireRole('admin'), async (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase();
  const { role } = req.body;
  if (!['customer', 'seller', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Некорректная роль' });
  }
  if (email === req.user.email) {
    return res.status(400).json({ error: 'Нельзя изменить собственную роль' });
  }
  const user = await User.findOneAndUpdate({ email }, { role }, { new: true });
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(user.toJSON());
});

export default router;
