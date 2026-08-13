import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  expiresAt: { type: Date, required: true },
});

// TTL index: MongoDB automatically deletes the session once expiresAt passes.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Session', sessionSchema);
