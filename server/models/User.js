import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  // Accounts created via the email-code flow have no password at all.
  password: { type: String, required: false },
  role: { type: String, enum: ['customer', 'seller', 'admin'], default: 'customer' },
});

// Defense in depth: even if a route accidentally serializes the full
// document, the password hash never reaches the client.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
