import mongoose from 'mongoose';

const sizeStockSchema = new mongoose.Schema(
  {
    size: { type: String, required: true },
    qty: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// Одна строка стока = один магазин (или один продавец без магазина),
// торгующий общей карточкой Product по своему размеру/количеству. Несколько
// ProductStock могут указывать на один и тот же productId — это и есть
// «один и тот же товар у разных магазинов», по которому заказ маршрутизуется
// туда, где реально есть нужный размер (см. server/routes/orders.js).
const productStockSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sellerEmail: { type: String, required: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    // Короткий код этой конкретной стоковой строки — просто для того, чтобы
    // продавец мог узнать свою запись среди чужих на той же карточке.
    code: { type: String, required: true, unique: true },
    sizes: { type: [sizeStockSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productStockSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('ProductStock', productStockSchema);
