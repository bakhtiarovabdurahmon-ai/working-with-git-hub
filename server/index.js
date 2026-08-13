import 'dotenv/config';
import app from './app.js';
import { connectDB } from './db.js';

const PORT = process.env.PORT || 4001;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ОдеждаPRO API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('Set MONGODB_URI in .env to a reachable MongoDB instance (local or Atlas).');
    process.exit(1);
  });
