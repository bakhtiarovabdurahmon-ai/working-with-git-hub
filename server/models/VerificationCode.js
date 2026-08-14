import mongoose from 'mongoose';

const verificationCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  code: { type: String, required: true },
  name: { type: String, default: '' },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  // Failed /verify-code attempts against this code — capped in the route
  // handler so a code can't be brute-forced within its 10-minute lifetime.
  attempts: { type: Number, default: 0 },
});

// TTL index: MongoDB automatically deletes the document once expiresAt passes.
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('VerificationCode', verificationCodeSchema);
