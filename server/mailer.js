const nodemailer = require('nodemailer');

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// Resend helper — used when RESEND_API_KEY is set
async function sendViaResend({ from, to, subject, html }) {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(error.message || JSON.stringify(error));
}

async function sendOrderNotification(order) {
  const transport = getTransport();
  if (!transport) return;
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  await transport.sendMail({
    from: `"Femmora" <${process.env.SMTP_USER}>`,
    to,
    subject: `Шинэ захиалга — ${order.order_no}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="font-size:18px;font-weight:600;margin-bottom:16px">🛍 Шинэ захиалга ирлээ</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:6px 0;color:#666">Захиалга №</td><td style="padding:6px 0;font-weight:600">${order.order_no}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Нэр</td><td style="padding:6px 0">${order.name}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Утас</td><td style="padding:6px 0">${order.phone}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Хаяг</td><td style="padding:6px 0">${order.address}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Тоо ширхэг</td><td style="padding:6px 0">${order.quantity}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Дүн</td><td style="padding:6px 0;font-weight:600">${order.amount.toLocaleString()}₮</td></tr>
          <tr><td style="padding:6px 0;color:#666">НӨЭТ</td><td style="padding:6px 0">${order.include_vat ? 'Тийм' : 'Үгүй'}</td></tr>
        </table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999">
          ${new Date().toLocaleString('mn-MN')}
        </div>
      </div>
    `,
  });
}

async function sendB2BNotification(inquiry) {
  const transport = getTransport();
  if (!transport) return;
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  await transport.sendMail({
    from: `"Femmora" <${process.env.SMTP_USER}>`,
    to,
    subject: `B2B хүсэлт — ${inquiry.company}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="font-size:18px;font-weight:600;margin-bottom:16px">🏢 Шинэ B2B хүсэлт</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:6px 0;color:#666">Байгууллага</td><td style="padding:6px 0;font-weight:600">${inquiry.company}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Холбоо барих</td><td style="padding:6px 0">${inquiry.contact_name}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Утас</td><td style="padding:6px 0">${inquiry.phone}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Имэйл</td><td style="padding:6px 0">${inquiry.email || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Мессеж</td><td style="padding:6px 0">${inquiry.message || '—'}</td></tr>
        </table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999">
          ${new Date().toLocaleString('mn-MN')}
        </div>
      </div>
    `,
  });
}

async function sendReviewNotification(review) {
  const transport = getTransport();
  if (!transport) return;
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  await transport.sendMail({
    from: `"Femmora" <${process.env.SMTP_USER}>`,
    to,
    subject: `Шинэ сэтгэгдэл ${stars} — ${review.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="font-size:18px;font-weight:600;margin-bottom:16px">⭐ Шинэ сэтгэгдэл</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:6px 0;color:#666">Нэр</td><td style="padding:6px 0;font-weight:600">${review.name}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Үнэлгээ</td><td style="padding:6px 0;font-size:16px;color:#c8a96e">${stars}</td></tr>
          <tr><td style="padding:6px 0;color:#666;vertical-align:top">Сэтгэгдэл</td><td style="padding:6px 0">${review.comment}</td></tr>
        </table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999">
          ${new Date().toLocaleString('mn-MN')}
        </div>
      </div>
    `,
  });
}

async function sendPaymentReminder(order) {
  const email = order.email || null;
  if (!email) return { ok: false, reason: 'Имэйл хаяг байхгүй' };

  const fromAddr = '"Femmora Beauty" <info@femmorabeauty.mn>';
  const subject  = `Таны захиалга — ${order.order_no} төлбөр хүлээгдэж байна`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f5ee">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:22px;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:#2a2420">FEMMORA</div>
        <div style="font-size:9px;letter-spacing:3px;color:#a09590;text-transform:uppercase;margin-top:4px">Beauty</div>
      </div>
      <div style="background:#fff;padding:24px;border:.5px solid #e2dbd7">
        <p style="font-size:14px;color:#2a2420;margin-bottom:8px">Сайн байна уу, <strong>${order.name}</strong>!</p>
        <p style="font-size:13px;color:#6b5f5a;line-height:1.8;margin-bottom:20px">
          Таны <strong>${order.order_no}</strong> дугаартай захиалгын төлбөр хүлээгдэж байна.
          Захиалгаа баталгаажуулахын тулд төлбөрөө төлнө үү.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
          <tr style="border-bottom:.5px solid #e2dbd7">
            <td style="padding:8px 0;color:#a09590">Захиалга №</td>
            <td style="padding:8px 0;font-weight:600;color:#2a2420">${order.order_no}</td>
          </tr>
          <tr style="border-bottom:.5px solid #e2dbd7">
            <td style="padding:8px 0;color:#a09590">Бүтээгдэхүүн</td>
            <td style="padding:8px 0;color:#2a2420">Silver Edition Air Cushion ${order.shade || ''} × ${order.quantity}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#a09590">Нийт дүн</td>
            <td style="padding:8px 0;font-weight:600;color:#2a2420;font-size:15px">${Number(order.amount).toLocaleString()}₮</td>
          </tr>
        </table>
        <div style="text-align:center">
          <a href="https://www.femmorabeauty.mn" style="display:inline-block;background:#2a2420;color:#f9f5ee;padding:12px 32px;font-size:10px;letter-spacing:3px;text-transform:uppercase;text-decoration:none">Төлбөр төлөх</a>
        </div>
      </div>
      <p style="text-align:center;font-size:10px;color:#c8c4c0;margin-top:20px">
        Асуух зүйл байвал: info@femmorabeauty.mn
      </p>
    </div>
  `;

  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ from: fromAddr, to: email, subject, html });
    } else {
      const transport = getTransport();
      if (!transport) return { ok: false, reason: 'SMTP тохиргоо байхгүй' };
      await transport.sendMail({ from: `"Femmora Beauty" <${process.env.SMTP_USER}>`, to: email, subject, html });
    }
    return { ok: true };
  } catch (e) {
    console.error('[mailer] sendPaymentReminder error:', e.message, e);
    return { ok: false, reason: e.message };
  }
}

// Маягт бөглөж эхэлсэн ч захиалга хийгээгүй хүнд follow-up имэйл
async function sendAbandonedFormEmail(lead) {
  const email = lead.email || null;
  if (!email) return { ok: false, reason: 'Имэйл хаяг байхгүй' };

  const fromAddr = '"Femmora Beauty" <info@femmorabeauty.mn>';
  const subject  = lead.name
    ? `${lead.name}, таны Silver Cushion таныг хүлээж байна 💝`
    : 'Таны Silver Cushion таныг хүлээж байна 💝';
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f5ee">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:22px;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:#2a2420">FEMMORA</div>
        <div style="font-size:9px;letter-spacing:3px;color:#a09590;text-transform:uppercase;margin-top:4px">Beauty</div>
      </div>
      <div style="background:#fff;padding:28px 24px;border:.5px solid #e2dbd7">
        <p style="font-size:14px;color:#2a2420;margin-bottom:8px">Сайн байна уу${lead.name ? ', <strong>' + lead.name + '</strong>' : ''}!</p>
        <p style="font-size:13px;color:#6b5f5a;line-height:1.8;margin-bottom:16px">
          Та манай <strong>Silver Edition Air Cushion</strong>-ыг сонирхож байсан байна.
          Таны гоо сайхны нэг алхам дутуу үлдсэн байна 🌸
        </p>
        <p style="font-size:13px;color:#6b5f5a;line-height:1.8;margin-bottom:24px">
          Захиалгаа дуусгаад 24–48 цагийн дотор хүргэлтээр аваарай.
          Асуух зүйл байвал бидэнтэй чөлөөтэй холбогдоорой!
        </p>
        <div style="text-align:center">
          <a href="https://www.femmorabeauty.mn/#order" style="display:inline-block;background:#2a2420;color:#f9f5ee;padding:13px 36px;font-size:10px;letter-spacing:3px;text-transform:uppercase;text-decoration:none">Захиалгаа дуусгах</a>
        </div>
      </div>
      <p style="text-align:center;font-size:10px;color:#c8c4c0;margin-top:20px">
        Femmora Beauty · www.femmorabeauty.mn
      </p>
    </div>
  `;

  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ from: fromAddr, to: email, subject, html });
    } else {
      const transport = getTransport();
      if (!transport) return { ok: false, reason: 'SMTP тохиргоо байхгүй' };
      await transport.sendMail({ from: `"Femmora Beauty" <${process.env.SMTP_USER}>`, to: email, subject, html });
    }
    return { ok: true };
  } catch (e) {
    console.error('[mailer] sendAbandonedFormEmail error:', e.message);
    return { ok: false, reason: e.message };
  }
}

module.exports = { sendOrderNotification, sendB2BNotification, sendReviewNotification, sendPaymentReminder, sendAbandonedFormEmail };
