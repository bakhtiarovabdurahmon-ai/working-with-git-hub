// Ловушка для сканеров/ботов: реальный посетитель или наше собственное
// приложение НИКОГДА не запросят эти пути — их дёргают только автоматические
// сканеры, ищущие типичные дыры (чужие CMS-панели, .env, .git, бэкапы БД).
// Кто попался — IP помечается и на сутки получает намного более жёсткий
// лимит запросов на весь остальной сайт (см. honeypotFlaggedRecently ниже,
// используется в app.js).
const HONEYPOT_PATHS = new Set([
  '/wp-login.php',
  '/wp-admin.php',
  '/wp-admin',
  '/wp-config.php',
  '/xmlrpc.php',
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.git/config',
  '/.git/HEAD',
  '/.aws/credentials',
  '/config.json',
  '/config.php',
  '/phpmyadmin',
  '/phpMyAdmin',
  '/pma',
  '/admin.php',
  '/administrator',
  '/administrator/index.php',
  '/server-status',
  '/actuator/env',
  '/actuator/health',
  '/debug/pprof',
  '/backup.sql',
  '/dump.sql',
  '/database.sql',
  '/api/v1/admin',
  '/.well-known/security.txt',
]);

const FLAG_DURATION_MS = 24 * 60 * 60 * 1000;
const flaggedIps = new Map(); // ip -> флаг снимается после этого момента

// Небольшая периодическая чистка, чтобы Map не рос бесконечно на
// долгоживущем процессе (pm2 держит его неделями).
setInterval(() => {
  const now = Date.now();
  for (const [ip, expiresAt] of flaggedIps) {
    if (expiresAt < now) flaggedIps.delete(ip);
  }
}, 60 * 60 * 1000).unref();

export function honeypotFlaggedRecently(ip) {
  const expiresAt = flaggedIps.get(ip);
  return !!expiresAt && expiresAt > Date.now();
}

export function honeypot(req, res, next) {
  if (!HONEYPOT_PATHS.has(req.path)) return next();

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  flaggedIps.set(ip, Date.now() + FLAG_DURATION_MS);
  console.warn(`[honeypot] ${ip} запросил ${req.path} — похоже на сканер, IP получит жёсткий лимит на сутки`);
  // Обычный 404 — не выдаём, что это ловушка, чтобы не подсказывать, какие
  // пути мы отслеживаем отдельно.
  res.status(404).type('text/plain').send('Not Found');
}
