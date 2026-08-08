import Session from '../models/Session.js';
import User from '../models/User.js';

// Verifies the Bearer session token issued by /api/auth/verify-code and
// attaches the account it belongs to as req.user. Every route that reads or
// changes anything account-specific (roles, products) must sit behind this —
// nothing here is optional, since without it any caller could act as anyone.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Нужен вход' });

  const session = await Session.findOne({ token });
  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }

  const user = await User.findOne({ email: session.email });
  if (!user) return res.status(401).json({ error: 'Аккаунт не найден' });

  req.user = user;
  next();
}

// Must run after requireAuth. Rejects with 403 unless req.user's role is in
// the allowed list — the server-side equivalent of the isAdmin/isSeller
// checks the UI already does (those only hide buttons, they don't protect
// the API).
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}
