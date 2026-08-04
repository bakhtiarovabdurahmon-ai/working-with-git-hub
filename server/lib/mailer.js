const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'WildBasket <onboarding@resend.dev>';

export async function sendVerificationEmail(to, code) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY не задан на сервере (см. .env.example)');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: `Код подтверждения: ${code}`,
      html: `
        <div style="font-family: sans-serif; max-width: 420px">
          <p>Ваш код для входа в WildBasket:</p>
          <p style="font-size: 32px; font-weight: 800; letter-spacing: 6px">${code}</p>
          <p style="color: #6b6b6b; font-size: 13px">Код действует 10 минут. Если это были не вы — просто проигнорируйте письмо.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('Не удалось отправить письмо через Resend: ' + body);
  }
}
