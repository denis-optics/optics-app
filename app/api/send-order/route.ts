import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    
    const clientName    = formData.get('clientName')    as string || 'Не вказано'
    const clientPhone   = formData.get('clientPhone')   as string || 'Не вказано'
    const clientCity    = formData.get('clientCity')    as string || 'Не вказано'
    const clientAddress = formData.get('clientAddress') as string || 'Не вказано'
    const clientStore   = formData.get('clientStore')   as string || 'Не вказано'
    const manager       = formData.get('manager')       as string || 'Не вказано'
    const comment       = formData.get('comment')       as string || 'Не вказано'
    const totalUSD      = formData.get('totalUSD')      as string || '0.00'
    const totalUAH      = formData.get('totalUAH')      as string || '0.00'
    
    const excelFile = formData.get('excelFile') as File | null

    // ✅ Беремо з .env.local
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
    const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '-1003801504284'

    // ✅ Логуємо щоб бачити що відбувається (видно у Vercel Logs)
    console.log('=== send-order ===')
    console.log('BOT_TOKEN present:', !!BOT_TOKEN, '| length:', BOT_TOKEN.length)
    console.log('CHAT_ID:', CHAT_ID)
    console.log('excelFile present:', !!excelFile)
    console.log('clientName:', clientName)

    if (!BOT_TOKEN) {
      console.error('❌ TELEGRAM_BOT_TOKEN не знайдено в .env.local!')
    }

    const escapeHtml = (text: string) =>
      String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const tgText =
      `<b>🛒 НОВЕ ЗАМОВЛЕННЯ</b>\n\n` +
      `👤 <b>Клієнт:</b> ${escapeHtml(clientName)}\n` +
      `📞 <b>Телефон:</b> ${escapeHtml(clientPhone)}\n` +
      `🏙 <b>Місто:</b> ${escapeHtml(clientCity)}\n` +
      `📦 <b>Адреса:</b> ${escapeHtml(clientAddress)}\n` +
      `🏪 <b>Магазин:</b> ${escapeHtml(clientStore)}\n` +
      `👨 <b>Менеджер:</b> ${escapeHtml(manager)}\n` +
      `💬 <b>Коментар:</b> ${escapeHtml(comment)}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Сума:</b> ${totalUAH} грн (${totalUSD}$)\n\n` +
      `📎 <i>Детальний список товарів у файлі Excel нижче.</i>`

    // 1. Telegram
    if (BOT_TOKEN && excelFile) {
      try {
        const tgFormData = new FormData()
        tgFormData.append('chat_id', CHAT_ID)
        tgFormData.append('caption', tgText)
        tgFormData.append('parse_mode', 'HTML')

        const buffer = Buffer.from(await excelFile.arrayBuffer())
        const blob   = new Blob([buffer], { type: excelFile.type })
        tgFormData.append('document', blob, excelFile.name)

        const tgRes = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
          { method: 'POST', body: tgFormData }
        )
        const tgJson = await tgRes.json()
        console.log('✅ Telegram response:', JSON.stringify(tgJson))

        if (!tgJson.ok) {
          console.error('❌ Telegram error:', tgJson.description)
        }
      } catch (tgErr) {
        console.error('❌ Telegram fetch error:', tgErr)
      }
    } else {
      console.warn('⚠️ Telegram пропущено: BOT_TOKEN порожній або немає файлу')
    }

    // 2. Пошта
    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.createTransport({
        host: 'smtp.ukr.net',
        port: 465,
        secure: true,
        auth: {
          user: process.env.MAIL_USER || 'opticsite@ukr.net',
          pass: process.env.MAIL_PASS || 'racQ1UMaUtCCBOso',
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
      })

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 12px;">
          <h2 style="color: #16a34a; margin-top: 0;">🛒 Нове замовлення</h2>
          <hr/>
          <p><b>Клієнт:</b> ${clientName}</p>
          <p><b>Телефон:</b> ${clientPhone}</p>
          <p><b>Місто:</b> ${clientCity}</p>
          <p><b>Адреса:</b> ${clientAddress}</p>
          <p><b>Магазин:</b> ${clientStore}</p>
          <p><b>Менеджер:</b> ${manager}</p>
          <p><b>Коментар:</b> ${comment}</p>
          <hr/>
          <h3 style="color: #1e3a8a;">Сума: ${totalUAH} грн (${totalUSD}$)</h3>
        </div>
      `

      if (excelFile) {
        // ✅ Зчитуємо файл ще раз (попередній arrayBuffer вже використаний)
        const fileBuffer = Buffer.from(await excelFile.arrayBuffer())
        await transporter.sendMail({
          from:    '"Оптика Платформа" <opticsite@ukr.net>',
          to:      'marinevich@ukr.net, zarudskiy777@gmail.com, orlova.lesya@gmail.com, alexstarkon95@gmail.com, yulyasereda@gmail.com',
          subject: `Нове замовлення: ${clientName}`,
          html:    emailHtml,
          attachments: [{ filename: excelFile.name, content: fileBuffer }]
        })
        console.log('✅ Email відправлено')
      }
    } catch (mailError) {
      console.error('❌ Помилка пошти:', mailError)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Критична помилка:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
