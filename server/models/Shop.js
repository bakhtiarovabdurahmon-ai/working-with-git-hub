import mongoose from 'mongoose';

// Магазин — группа из нескольких продавцов (2-3 человека), которые вместе
// добавляют товары и подтверждают заказы друг за друга. Товары и заказы
// привязываются к shopId, а не к конкретному сотруднику, поэтому любой
// участник магазина видит и обрабатывает общие заказы.
const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // ID-код магазина (без цифры 6, как и у пользователей) — по нему
    // супер админ/админ добавляет сотрудников в магазин.
    code: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

shopSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Shop', shopSchema);
