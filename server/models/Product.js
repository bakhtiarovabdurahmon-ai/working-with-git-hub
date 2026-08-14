import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    brand: { type: String, default: 'Продавец' },
    price: { type: Number, required: true },
    oldPrice: { type: Number, default: null },
    discount: { type: Number, default: 0 },
    rating: { type: Number, default: 5 },
    reviews: { type: Number, default: 0 },
    emoji: { type: String, default: null },
    image: { type: String, default: null },
    color: { type: String, default: '#f4f4f6' },
    description: { type: String, default: '' },
    sizes: { type: [String], default: [] },
    qty: { type: Number, default: 0 },
    inStock: { type: Boolean, default: true },
    sellerEmail: { type: String, default: null },
    // Магазин, к которому привязан товар (если продавец состоит в магазине) —
    // заказы на такой товар видят все сотрудники магазина, а не только тот,
    // кто его добавил. null = товар вне магазина (общий каталог или продавец
    // без магазина).
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
  },
  { timestamps: true }
);

productSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Product', productSchema);
