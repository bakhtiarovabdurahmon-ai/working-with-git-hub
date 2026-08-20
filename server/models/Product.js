import mongoose from 'mongoose';

// Продукт — это ОДНА общая карточка на весь сайт (то, что видит покупатель),
// а не собственность одного магазина. Кто именно продаёт её и сколько у
// кого есть на складе — в ProductStock (несколько магазинов могут стоять за
// одной карточкой, у каждого свой сток и свой код, см. server/routes/products.js).
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
    // image — обложка (первое фото), используется везде, где нужна одна
    // картинка (карточка в каталоге, промо-полоса, корзина). images — вся
    // галерея, которую продавец мог сфотографировать и добавить (без
    // ограничения по числу), показывается только на странице самого товара.
    image: { type: String, default: null },
    images: { type: [String], default: [] },
    color: { type: String, default: '#f4f4f6' },
    description: { type: String, default: '' },
    // Размеры, в которых этот товар когда-либо заводили на склад хотя бы
    // одним магазином — растёт, когда новый магазин присоединяется со своим
    // стоком нового размера (см. POST /api/products/:id/stock).
    sizes: { type: [String], default: [] },
    // true — распродана везде (сумма остатков по всем магазинам = 0).
    // Карточка прячется из каталога, но не удаляется: её видно в поиске
    // (см. GET /api/products/search) с количеством 0, чтобы можно было
    // снова присоединить сток при поступлении.
    archived: { type: Boolean, default: false },
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
