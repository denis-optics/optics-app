import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ success: false, message: "No body" }, { status: 400 })

    // 🌟 ОБНОВЛЕННЫЙ НОВЫЙ ТОКЕН
    const BOT_TOKEN = '8902109006:AAFc8yDh3qUME30aUtIXHqSbgj1XJjKcq0w'
    
    // 🌟 ВСТАВЬТЕ СЮДА ID, КОТОРЫЙ ВЫ ПОЛУЧИЛИ НА ШАГЕ 1 (например '220058690' или номер группы с минусом)
    const CHAT_ID = '220058690' 

    const escapeHtml = (text: any) => {
      return String(text || '-')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    const text = `<b>🛒 НОВЕ ЗАМОВЛЕННЯ</b>\n\n` +
      `👤 <b>Клієнт:</b> ${escapeHtml(body.clientName)}\n` +
      `📞 <b>Телефон:</b> ${escapeHtml(body.clientPhone)}\n` +
      `🏙 <b>Місто:</b> ${escapeHtml(body.clientCity)}\n` +
      `📦 <b>Адреса:</b> ${escapeHtml(body.clientAddress)}\n` +
      `🏪 <b>Магазин:</b> ${escapeHtml(body.clientStore)}\n` +
      `👨 <b>Менеджер:</b> ${escapeHtml(body.manager)}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `${escapeHtml(body.products).substring(0, 3000)}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Сума:</b> ${escapeHtml(body.total)} грн`

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: text,
          parse_mode: 'HTML',
        }),
      }
    )

    const responseData = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json({ 
        success: false, 
        error: "Telegram Error", 
        telegramDescription: responseData.description || "Unknown"
      }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}