import mongoose from 'mongoose';

// Приз "колеса фортуны" — продавцы добавляют то, что готовы разыгрывать
// (одежда/кешбек/скидка), покупатели тратят кешбек на прокрутку.
const wheelPrizeSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: { type: String, enum: ['clothing', 'cashback', 'discount'], required: true },
    // Для type=cashback — сумма в сомах, начисляется победителю сразу.
    // Для type=discount — процент скидки (просто отображается в призе).
    // Для type=clothing — не используется, приз описывается текстом в label.
    value: { type: Number, default: 0 },
    sellerEmail: { type: String, default: null },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

wheelPrizeSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('WheelPrize', wheelPrizeSchema);
