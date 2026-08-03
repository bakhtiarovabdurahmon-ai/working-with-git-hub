import { Router } from 'express';
import Product from '../models/Product.js';

const router = Router();

router.get('/', async (req, res) => {
  const products = await Product.find({}).sort({ createdAt: -1 });
  res.json(products.map((p) => p.toJSON()));
});

router.post('/', async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Не удалось сохранить товар' });
  }
});

router.delete('/:id', async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Товар не найден' });
  res.status(204).end();
});

export default router;
