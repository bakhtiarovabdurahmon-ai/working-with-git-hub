// Числовой ID-код аккаунта — клиентская версия для автономного режима
// (без сервера). Никогда не содержит цифру 6 (см. server/lib/codes.js).
const DIGITS = ['0', '1', '2', '3', '4', '5', '7', '8', '9'];
const FIRST_DIGITS = DIGITS.filter((d) => d !== '0');

export function generateCode() {
  const first = FIRST_DIGITS[Math.floor(Math.random() * FIRST_DIGITS.length)];
  const second = DIGITS[Math.floor(Math.random() * DIGITS.length)];
  const third = DIGITS[Math.floor(Math.random() * DIGITS.length)];
  return first + second + third;
}
