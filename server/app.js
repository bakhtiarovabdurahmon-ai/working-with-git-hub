import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import productsRoutes from './routes/products.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // seller product photos are inlined as data URLs

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Every other /api route needs the database — connect lazily (and only
// once per warm serverless instance, see db.js) rather than blocking
// module load, since that also has to work in a serverless environment.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: 'База данных недоступна: ' + err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);

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
