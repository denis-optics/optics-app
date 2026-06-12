// app/api/send-order/route.ts
import { NextResponse } from 'next/server'
import { generateExcelBuffer } from '@/app/lib/generateExcel'

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
    const totalUSD      = parseFloat(formData.get('totalUSD') as string || '0')
    const totalUAH      = parseFloat(formData.get('totalUAH') as string || '0')
    const cartJson      = formData.get('cart')          as string || '[]'

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
    const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '-1003801504284'

    // ✅ Парсимо кошик переданий з фронтенду
    let cart = []
    try { cart = JSON.parse(cartJson) } catch {}
    cart = cart.map((item: any) => ({
  ...item,
  image: item.image
    ? `http://optics-app.vercel.app/${item.image}`
    : ''
}))
console.log(cart[0])
    // ✅ Генеруємо красивий Excel через exceljs
    const fileBuffer = await generateExcelBuffer({
      clientName, clientPhone, clientCity, clientAddress,
      clientStore, manager, comment,
      totalUSD, totalUAH,
      currentRate: parseFloat(formData.get('currentRate') as string || '44.2'),
      markup: 1.02,
      cart,
    })

    const fileName = `zamovlennya_${clientName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('uk-UA').replace(/\./g, '-')}.xlsx`
    const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    const escapeHtml = (t: string) =>
      String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

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
      `💰 <b>Сума:</b> ${Math.round(totalUAH)} грн (${totalUSD.toFixed(2)}$)\n\n` +
      `📎 <i>Детальний список у файлі Excel нижче.</i>`

    // 1. Telegram
    if (BOT_TOKEN) {
     try {
        const tgFormData = new FormData()
        tgFormData.append('chat_id', CHAT_ID)
        tgFormData.append('caption', tgText)
        tgFormData.append('parse_mode', 'HTML')
        tgFormData.append(
         'document',
         new Blob(
         [Uint8Array.from(fileBuffer)],
         { type: fileType }
        ),
         fileName
         )
        const tgRes  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          method: 'POST', body: tgFormData
        })
        const tgJson = await tgRes.json()
        if (!tgJson.ok) console.error('❌ Telegram:', tgJson.description)
        else            console.log('✅ Telegram: відправлено')
      } catch (e) {
        console.error('❌ Telegram error:', e)
      }
    }

    // 2. Пошта
    try {
      const nodemailer  = await import('nodemailer')
      const transporter = nodemailer.createTransport({
        host: 'smtp.ukr.net', port: 465, secure: true,
        auth: {
          user: process.env.MAIL_USER || 'opticsite@ukr.net',
          pass: process.env.MAIL_PASS || '',
        },
        connectionTimeout: 5000,
        greetingTimeout:   5000,
     })

      await transporter.sendMail({
        from:    '"Оптика Платформа" <opticsite@ukr.net>',
        to:      'marinevich@ukr.net, zarudskiy777@gmail.com, orlova.lesya@gmail.com, alexstarkon95@gmail.com, yulyasereda@gmail.com',
        subject: `Нове замовлення: ${clientName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;border:1px solid #ddd;padding:20px;border-radius:12px">
            <h2 style="color:#16a34a;margin-top:0">🛒 Нове замовлення</h2><hr/>
            <p><b>Клієнт:</b> ${clientName}</p>
            <p><b>Телефон:</b> ${clientPhone}</p>
            <p><b>Місто:</b> ${clientCity}</p>
            <p><b>Адреса:</b> ${clientAddress}</p>
            <p><b>Магазин:</b> ${clientStore}</p>
            <p><b>Менеджер:</b> ${manager}</p>
            <p><b>Коментар:</b> ${comment}</p><hr/>
            <h3 style="color:#1e3a8a">Сума: ${Math.round(totalUAH)} грн (${totalUSD.toFixed(2)}$)</h3>
          </div>`,
        attachments: [{ filename: fileName, content: fileBuffer }]
      })
      console.log('✅ Email: відправлено')
    } catch (e) {
      console.error('❌ Email error:', e)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Критична помилка:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
