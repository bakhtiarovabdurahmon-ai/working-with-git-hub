import crypto from 'node:crypto';
import { Router } from 'express';
import User from '../models/User.js';
import VerificationCode from '../models/VerificationCode.js';
import Session from '../models/Session.js';
import { sendVerificationEmail } from '../lib/mailer.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const CODE_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 30 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/request-code', async (req, res) => {
  try {
    const { email, name } = req.body;
    const key = (email || '').trim().toLowerCase();
    if (!key) return res.status(400).json({ error: 'Укажите email' });

    // Throttle so one caller can't spam an inbox or burn through the
    // sender's email quota by hammering this endpoint.
    const recent = await VerificationCode.findOne({ email: key }).sort({ createdAt: -1 });
    if (recent && Date.now() - recent.createdAt.getTime() < REQUEST_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Код уже отправлен, подождите немного перед повторной отправкой' });
    }

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
      try {
        user = await User.create({
          name: record.name || key,
          email: key,
          role: isFirstUser ? 'admin' : 'customer',
        });
      } catch (err) {
        // Another concurrent verify-code for the same brand-new email won
        // the race and already created the account — just use it.
        if (err.code === 11000) user = await User.findOne({ email: key });
        else throw err;
      }
    }

    await VerificationCode.deleteMany({ email: key });

    const token = crypto.randomBytes(32).toString('hex');
    await Session.create({ token, email: key, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });

    res.json({ user: user.toJSON(), token });
  } catch (err) {
    res.status(500).json({ error: 'Не удалось подтвердить код' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user.toJSON());
});

export default router;
