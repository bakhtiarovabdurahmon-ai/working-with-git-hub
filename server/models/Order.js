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
    // Кто добавил товар (для истории) — null для товаров общего каталога.
    sellerEmail: { type: String, default: null },
    // Магазин, которому направлен заказ — его видят все сотрудники магазина,
    // а не только тот, кто добавил товар. null = общий каталог магазина
    // (видят только admin/superadmin).
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true },
    fulfillment: { type: String, enum: ['delivery', 'reserve'], required: true },
    // Только для fulfillment=delivery — либо координаты с браузерной
    // геолокации (со ссылкой на карту), либо адрес, введённый вручную, если
    // покупатель не разрешил доступ к местоположению.
    deliveryAddress: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending_stock', 'out_of_stock', 'awaiting_payment', 'payment_review', 'completed'],
      default: 'pending_stock',
    },
    receiptFileName: { type: String, default: null },
    // Скриншот квитанции целиком (data URL), чтобы супер админ реально мог
    // сверить сумму/время/номер платежа с заказом, а не просто видеть имя файла.
    receiptImage: { type: String, default: null },
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
