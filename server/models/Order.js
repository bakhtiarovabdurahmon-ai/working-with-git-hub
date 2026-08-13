import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    title: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

// Жизненный цикл заказа:
// pending_stock (создан, ждёт продавца) -> awaiting_payment (товар есть, ждём перевод)
//   -> payment_review (покупатель отметил "перевёл") -> completed (супер админ подтвердил перевод, товар отдаётся)
// pending_stock -> out_of_stock (продавец сказал, что товара нет — тупиковый статус)
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    buyerEmail: { type: String, required: true },
    buyerName: { type: String, default: '' },
    // null = товар из общего каталога магазина (не добавлен конкретным продавцом) —
    // такие заказы видят только admin/superadmin.
    sellerEmail: { type: String, default: null },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true },
    fulfillment: { type: String, enum: ['delivery', 'reserve'], required: true },
    status: {
      type: String,
      enum: ['pending_stock', 'out_of_stock', 'awaiting_payment', 'payment_review', 'completed'],
      default: 'pending_stock',
    },
    receiptFileName: { type: String, default: null },
  },
  { timestamps: true }
);

orderSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Order', orderSchema);
