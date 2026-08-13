// Числовой ID-код аккаунта (для назначения админа супер-админом). По
// требованию — никогда не содержит цифру 6.
const DIGITS = ['0', '1', '2', '3', '4', '5', '7', '8', '9'];
const FIRST_DIGITS = DIGITS.filter((d) => d !== '0');

export function generateCode() {
  const first = FIRST_DIGITS[Math.floor(Math.random() * FIRST_DIGITS.length)];
  const second = DIGITS[Math.floor(Math.random() * DIGITS.length)];
  const third = DIGITS[Math.floor(Math.random() * DIGITS.length)];
  return first + second + third;
}

export async function generateUniqueCode(User) {
  for (let i = 0; i < 30; i += 1) {
    const code = generateCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ code });
    if (!exists) return code;
  }
  throw new Error('Не удалось создать уникальный ID-код');
}
