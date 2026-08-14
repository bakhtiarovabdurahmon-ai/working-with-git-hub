import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  // Accounts created via the email-code flow have no password at all.
  password: { type: String, required: false },
  role: { type: String, enum: ['customer', 'seller', 'admin', 'superadmin'], default: 'customer' },
  // Short ID code so the (single) superadmin can promote someone to admin
  // by code instead of hunting them down in the table. The superadmin
  // account itself has none — it's not something you promote into.
  code: { type: String, unique: true, sparse: true },
  // Магазин, к которому привязан продавец — несколько сотрудников (2-3
  // человека) могут состоять в одном магазине и вместе подтверждать заказы
  // друг друга. null = не назначен ни в какой магазин.
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
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
