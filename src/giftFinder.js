// Подбор размера и стиля для раздела «Подбор подарка».
//
// Размер по росту/весу — настоящий расчёт (базовый размер по росту,
// скорректированный по ИМТ). Определение силуэта/стиля по фото —
// честная демо-симуляция: реальный ИИ-анализ телосложения по фото
// потребовал бы отдельного сервиса компьютерного зрения, которого у
// этого магазина нет. Из фото мы берём только средний цвет — это можно
// посчитать прямо в браузере — и используем его, чтобы предложить
// подходящую цветовую гамму товаров.

const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function sizeFromMeasurements(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return 'M';

  let index;
  if (h < 168) index = 0;
  else if (h < 176) index = 1;
  else if (h < 184) index = 2;
  else if (h < 192) index = 3;
  else index = 4;

  const bmi = w / (h / 100) ** 2;
  if (bmi < 19) index -= 1;
  else if (bmi > 32) index += 2;
  else if (bmi > 27) index += 1;

  index = Math.max(0, Math.min(SIZE_ORDER.length - 1, index));
  return SIZE_ORDER[index];
}

export function styleFromAge(age) {
  const a = Number(age);
  if (Number.isFinite(a) && a <= 25) {
    return { label: 'Спортивный, повседневный', categories: ['tshirts', 'knitwear', 'shoes', 'accessories'] };
  }
  if (Number.isFinite(a) && a >= 41) {
    return { label: 'Классический', categories: ['shirts', 'pants', 'outerwear', 'accessories'] };
  }
  return { label: 'Повседневно-деловой', categories: ['shirts', 'tshirts', 'pants', 'outerwear'] };
}

// Средний цвет фото — реальный расчёт по пикселям (уменьшенное до 1x1
// изображение на canvas), просто грубый, а не "распознавание стиля".
export function averageColorFromImage(imageEl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageEl, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

export function pickGiftProducts(allProducts, { size, categories }) {
  const inCategory = allProducts.filter((p) => categories.includes(p.category));
  const withSize = inCategory.filter((p) => !p.sizes || p.sizes.includes(size));
  const pool = withSize.length >= 6 ? withSize : inCategory;
  return [...pool].sort((a, b) => b.rating - a.rating).slice(0, 8);
}
