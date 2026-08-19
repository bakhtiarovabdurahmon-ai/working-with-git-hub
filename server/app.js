import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import shopsRoutes from './routes/shops.js';
import { rateLimit, ipKey } from './middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
// Behind Vercel's (or any) reverse proxy, req.ip otherwise resolves to the
// proxy's address instead of the real client — that would collapse every
// visitor into one rate-limit bucket. Trusting the first hop reads the
// real client IP from X-Forwarded-For.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Browsers only need CORS at all because the frontend and API are meant to
// be same-origin (see api.js) — this allowlist exists to stop an arbitrary
// third-party site from making authenticated calls against this API from a
// visitor's browser, not to open things up. Requests without an Origin
// header (curl, server-to-server, same-origin page loads) aren't subject to
// CORS in the first place and are always allowed through.
const DEFAULT_ORIGINS = ['https://odejda-pro.ru', 'https://www.odejda-pro.ru', 'http://localhost:5173', 'http://localhost:4001'];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '5mb' })); // seller product photos are inlined as data URLs

// Generous IP-wide floor on top of the tighter per-route limiters in
// routes/auth.js and routes/orders.js — those guard specific abuse-prone
// actions (sending emails, creating orders), this one just stops a single
// source from hammering the API generally (catalog scraping, etc.).
app.use('/api', rateLimit({ windowMs: 5 * 60 * 1000, max: 300, keyFn: ipKey }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Delivery orders ask for geolocation (see src/pages/Cart.jsx) — everything
  // else the browser could ask this origin for is denied by default.
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()');
  // Forces HTTPS for a year including subdomains, once a visitor has loaded
  // the site over HTTPS once — blocks SSL-stripping downgrade attacks now
  // that the domain has a real certificate (see nginx/certbot setup).
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // React renders everything through the DOM (no dangerouslySetInnerHTML in
  // this codebase) and there's no inline <script> left (see
  // public/theme-init.js) — so a strict script-src costs nothing here and
  // blocks injected/inline scripts outright if an XSS bug ever slips in.
  // style-src needs 'unsafe-inline' because React writes inline style="..."
  // attributes for layout (not <style> blocks) — CSP has no safer knob for
  // that short of rewriting every component to CSS classes.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  next();
});

// Every /api route (including health) needs the database — connect lazily
// (and only once per warm serverless instance, see db.js) rather than
// blocking module load, since that also has to work in a serverless
// environment. /api/health deliberately goes through this too: the
// frontend's checkServer() uses it to decide whether real backend storage
// is usable, so it must reflect actual DB reachability, not just that the
// process is running.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: 'База данных недоступна: ' + err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/shops', shopsRoutes);

// Catches anything thrown/rejected in an /api handler (Express 5 forwards
// async rejections here automatically) so a bad request — e.g. an
// invalid-format id, which Mongoose rejects as a CastError before our own
// validation gets a chance — always gets a clean JSON response instead of
// Express's default HTML error page (which, without NODE_ENV=production
// set correctly, would also leak the stack trace to the client).
app.use('/api', (err, req, res, _next) => {
  console.error(err);
  if (err.name === 'CastError') return res.status(400).json({ error: 'Некорректный идентификатор' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: 'Некорректные данные' });
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// If the frontend has been built (npm run build), serve it from the same
// service — used when running as one persistent process (local dev,
// Render). On Vercel the static files are served by the platform instead,
// and this function only ever handles /api/* requests.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

export default app;
