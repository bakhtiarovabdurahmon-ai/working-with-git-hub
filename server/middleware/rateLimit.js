// Minimal in-memory rate limiter — no extra dependency needed for a project
// this size. Caveat: state lives in process memory, so on a serverless
// platform (Vercel) each cold instance starts a fresh counter; this still
// blunts sustained abuse from a single warm instance and fully protects the
// persistent-server deployment mode (`npm run server`), it just isn't a
// hard global guarantee across every instance. Real per-email/per-code caps
// (see routes/auth.js) are the primary defense; this is a second layer.

const buckets = new Map();

// Sweep old buckets periodically so the Map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

export function rateLimit({ windowMs, max, keyFn }) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Слишком много запросов, попробуйте позже' });
    }
    next();
  };
}

export function ipKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
