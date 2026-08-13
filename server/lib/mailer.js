const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'ОдеждаPRO <onboarding@resend.dev>';

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
          <p>Ваш код для входа в ОдеждаPRO:</p>
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

export async function sendOrderNotification(to, order) {
  if (!RESEND_API_KEY) return; // Best-effort: заказ не должен падать из-за письма.

  const itemsHtml = order.items
    .map((it) => `<li>${it.title} × ${it.qty} — ${it.price * it.qty} сом</li>`)
    .join('');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: `Новый заказ ${order.orderNumber} — подтвердите наличие`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px">
          <p>Новый заказ <strong>${order.orderNumber}</strong> от ${order.buyerName || order.buyerEmail}.</p>
          <p>Способ получения: ${order.fulfillment === 'delivery' ? 'доставка' : 'бронирование'}</p>
          <ul>${itemsHtml}</ul>
          <p>Итого: <strong>${order.total} сом</strong></p>
          <p style="color: #6b6b6b; font-size: 13px">Зайдите в раздел «Заказы» на сайте и подтвердите, есть ли товар в наличии.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Best-effort только для доставки уведомления — в песочнице Resend
    // письма идут лишь на адрес владельца аккаунта, это ожидаемо.
    console.error('Не удалось отправить уведомление о заказе:', body);
  }
}
