import mongoose from 'mongoose';

// Один выигрыш в колесе фортуны = один талон на выдачу. QR-код на странице
// колеса кодирует ссылку на этот талон — продавец сканирует его обычным
// сканером (открывается страница с названием приза) и жмёт «Выдать»,
// после чего талон гасится и повторно им уже не воспользоваться.
const wheelRedemptionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    prizeLabel: { type: String, required: true },
    prizeType: { type: String, enum: ['clothing', 'cashback', 'discount'], required: true },
    prizeValue: { type: Number, default: 0 },
    buyerEmail: { type: String, required: true },
    sellerEmail: { type: String, default: null },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    redeemed: { type: Boolean, default: false },
    redeemedAt: { type: Date, default: null },
    redeemedBy: { type: String, default: null },
  },
  { timestamps: true }
);

wheelRedemptionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('WheelRedemption', wheelRedemptionSchema);
