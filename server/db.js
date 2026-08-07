import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wildbasket';

// Serverless (Vercel) invokes this on every request, sometimes on a warm
// instance that already has a connection — cache it globally so we don't
// reconnect to MongoDB on every single request.
const cached = globalThis.__mongooseCache || (globalThis.__mongooseCache = { conn: null, promise: null });

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
