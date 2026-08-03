import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const key = (email || '').trim().toLowerCase();
    if (!key || !password) return res.status(400).json({ error: 'Заполните email и пароль' });

    const existing = await User.findOne({ email: key });
    if (existing) return res.status(409).json({ error: 'Такой email уже зарегистрирован' });

    const isFirstUser = (await User.countDocuments({})) === 0;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: (name || '').trim() || key,
      email: key,
      password: passwordHash,
      role: isFirstUser ? 'admin' : 'customer',
    });

    res.status(201).json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: 'Не удалось зарегистрировать пользователя' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const key = (email || '').trim().toLowerCase();
    const user = await User.findOne({ email: key });
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const ok = await bcrypt.compare(password || '', user.password);
    if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: 'Не удалось войти' });
  }
});

export default router;
