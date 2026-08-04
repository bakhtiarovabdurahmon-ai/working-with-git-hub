import { Router } from 'express';
import User from '../models/User.js';
import VerificationCode from '../models/VerificationCode.js';
import { sendVerificationEmail } from '../lib/mailer.js';

const router = Router();
const CODE_TTL_MS = 10 * 60 * 1000;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/request-code', async (req, res) => {
  try {
    const { email, name } = req.body;
    const key = (email || '').trim().toLowerCase();
    if (!key) return res.status(400).json({ error: 'Укажите email' });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    // Only the latest code for this email is valid.
    await VerificationCode.deleteMany({ email: key });
    await VerificationCode.create({ email: key, code, name: (name || '').trim(), expiresAt });

    await sendVerificationEmail(key, code);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Не удалось отправить код' });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const key = (email || '').trim().toLowerCase();
    if (!key || !code) return res.status(400).json({ error: 'Укажите email и код' });

    const record = await VerificationCode.findOne({ email: key, code: String(code).trim() });
    if (!record) return res.status(401).json({ error: 'Неверный код' });
    if (record.expiresAt < new Date()) {
      await record.deleteOne();
      return res.status(401).json({ error: 'Код истёк, запросите новый' });
    }

    let user = await User.findOne({ email: key });
    if (!user) {
      const isFirstUser = (await User.countDocuments({})) === 0;
      user = await User.create({
        name: record.name || key,
        email: key,
        role: isFirstUser ? 'admin' : 'customer',
      });
    }

    await VerificationCode.deleteMany({ email: key });
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: 'Не удалось подтвердить код' });
  }
});

export default router;
