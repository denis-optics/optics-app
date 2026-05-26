import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Токен вашего бота остаётся прежним
    const BOT_TOKEN = '8902109006:AAFc8yDh3qUME30aUtIXHqSbgj1XJjKcq0w'
    
    // ВСТАВЬТЕ СЮДА ID ВАШЕЙ ГРУППЫ (обязательно с минусом и -100, если это супергруппа)
    // Например: '-100220058690' или тот, который вы узнали через getUpdates
    const CHAT_ID = '-1003801504284' 

    // Безопасное экранирование базовых HTML символов
    const escapeHtml = (text: string) => {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    const clientName = escapeHtml(body.clientName)
    const clientPhone = escapeHtml(body.clientPhone)
    const clientCity = escapeHtml(body.clientCity)
    const clientAddress = escapeHtml(body.clientAddress)
    const clientStore = escapeHtml(body.clientStore)
    const manager = escapeHtml(body.manager)
    
    // Форматируем список товаров
    let productsList = escapeHtml(body.products)
    if (productsList.length > 3500) {
      productsList = productsList.substring(0, 3500) + '\n\n⚠️ Список скорочено через ліміт Telegram!';
    }

    // Собираем текст с использованием HTML-тегов <b> вместо звездочек
    const text = `<b>🛒 НОВЕ ЗАМОВЛЕННЯ В ГРУПУ</b>\n\n` +
      `👤 <b>Клієнт:</b> ${clientName}\n` +
      `📞 <b>Телефон:</b> ${clientPhone}\n` +
      `🏙 <b>Місто:</b> ${clientCity}\n` +
      `📦 <b>Адреса:</b> ${clientAddress}\n` +
      `🏪 <b>Магазин:</b> ${clientStore}\n` +
      `👨 <b>Менеджер:</b> ${manager}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `${productsList}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Сума:</b> ${body.total || '0.00'} грн`

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: 'HTML', // Защищает от падений при наличии знаков "-", "_", "["
        }),
      }
    )

    const responseData = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('Ошибка от Telegram API:', responseData)
      return NextResponse.json({ success: false, error: responseData }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Критическая ошибка на сервере:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}