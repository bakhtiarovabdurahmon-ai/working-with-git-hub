import crypto from 'node:crypto';
import { Router } from 'express';
import User from '../models/User.js';
import VerificationCode from '../models/VerificationCode.js';
import Session from '../models/Session.js';
import { sendVerificationEmail } from '../lib/mailer.js';
import { requireAuth } from '../middleware/auth.js';
import { generateUniqueCode } from '../lib/codes.js';
import { rateLimit, ipKey } from '../middleware/rateLimit.js';

const router = Router();
// Per-IP caps as a second layer on top of the per-email cooldown below —
// without this, an attacker can't be slowed by the per-email throttle if
// they simply spray requests across many different email addresses.
const requestCodeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, keyFn: ipKey });
const verifyCodeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, keyFn: ipKey });
const CODE_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 30 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// After this many wrong guesses, the code is burned — attacker can't keep
// guessing against the same code for the rest of its 10-minute lifetime.
const MAX_VERIFY_ATTEMPTS = 5;

// crypto.randomInt (not Math.random) — this code is a real credential, not
// just a display id, so it needs to be unpredictable to an attacker who
// might know the PRNG's other outputs.
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

router.post('/request-code', requestCodeLimiter, async (req, res) => {
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

router.post('/verify-code', verifyCodeLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    const key = (email || '').trim().toLowerCase();
    if (!key || !code) return res.status(400).json({ error: 'Укажите email и код' });

    // Look up by email only (not email+code) so a wrong guess still counts
    // against the one outstanding code instead of silently missing.
    const record = await VerificationCode.findOne({ email: key });
    if (!record || record.expiresAt < new Date()) {
      if (record) await record.deleteOne();
      return res.status(401).json({ error: 'Код истёк или не запрошен, запросите новый' });
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await record.deleteOne();
      return res.status(429).json({ error: 'Слишком много попыток, запросите новый код' });
    }

    if (record.code !== String(code).trim()) {
      record.attempts += 1;
      await record.save();
      return res.status(401).json({ error: 'Неверный код' });
    }

    let user = await User.findOne({ email: key });
    let isNew = false;
    if (!user) {
      isNew = true;
      const isFirstUser = (await User.countDocuments({})) === 0;
      try {
        user = await User.create({
          name: record.name || key,
          email: key,
          // The very first account is the one and only superadmin; everyone
          // else gets an ID code the superadmin can use to promote them.
          role: isFirstUser ? 'superadmin' : 'customer',
          code: isFirstUser ? undefined : await generateUniqueCode(User),
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

    res.json({ user: user.toJSON(), token, isNew });
  } catch (err) {
    res.status(500).json({ error: 'Не удалось подтвердить код' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user.toJSON());
});

// Revokes the session server-side (not just forgetting the token on the
// client) — without this, "logging out" left the token valid for the rest
// of its 30-day life, so a leaked token couldn't be shut off.
router.post('/logout', requireAuth, async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) await Session.deleteOne({ token });
  res.status(204).end();
});

export default router;
