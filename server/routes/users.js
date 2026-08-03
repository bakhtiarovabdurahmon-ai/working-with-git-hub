import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

// List of users for the admin panel — passwords are never included (see User.toJSON).
router.get('/', async (req, res) => {
  const users = await User.find({}).sort({ email: 1 });
  res.json(users.map((u) => u.toJSON()));
});

router.patch('/:email', async (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase();
  const { role } = req.body;
  if (!['customer', 'seller', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Некорректная роль' });
  }
  const user = await User.findOneAndUpdate({ email }, { role }, { new: true });
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(user.toJSON());
});

export default router;
