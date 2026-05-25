import { NextResponse } from 'next/server'

export async function POST(req: Request) {

  try {

    const body = await req.json()

    const BOT_TOKEN = 'ТВОЙ_BOT_TOKEN'
    const CHAT_ID = 'ТВОЙ_CHAT_ID'

    const text = `
🛒 НОВЕ ЗАМОВЛЕННЯ

👤 Клієнт: ${body.clientName}
📞 Телефон: ${body.clientPhone}
🏙 Місто: ${body.clientCity}
📦 Адреса: ${body.clientAddress}
🏪 Магазин: ${body.clientStore}
👨 Менеджер: ${body.manager}

━━━━━━━━━━━━━━

${body.products}

━━━━━━━━━━━━━━

💰 Сума: ${body.total} грн
`

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
        }),
      }
    )

    if (!response.ok) {

      return NextResponse.json(
        {
          success: false,
        },
        {
          status: 500,
        }
      )

    }

    return NextResponse.json({
      success: true,
    })

  } catch (error) {

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    )

  }

}