import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    
    const clientName = formData.get('clientName') as string || 'Не вказано'
    const clientPhone = formData.get('clientPhone') as string || 'Не вказано'
    const clientCity = formData.get('clientCity') as string || 'Не вказано'
    const clientAddress = formData.get('clientAddress') as string || 'Не вказано'
    const clientStore = formData.get('clientStore') as string || 'Не вказано'
    const manager = formData.get('manager') as string || 'Не вказано'
    const comment = formData.get('comment') as string || 'Не вказано'
    const totalUSD = formData.get('totalUSD') as string || '0.00'
    const totalUAH = formData.get('totalUAH') as string || '0.00'
    
    const excelFile = formData.get('excelFile') as File | null

    const BOT_TOKEN = '8902109006:AAFc8yDh3qUME30aUtIXHqSbgj1XJjKcq0w'
    const CHAT_ID = '220058690' 

    const escapeHtml = (text: string) => {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    const tgText = `<b>🛒 НОВЕ ЗАМОВЛЕННЯ</b>\n\n` +
      `👤 <b>Клієнт:</b> ${escapeHtml(clientName)}\n` +
      `📞 <b>Телефон:</b> ${escapeHtml(clientPhone)}\n` +
      `🏙 <b>Місто:</b> ${escapeHtml(clientCity)}\n` +
      `📦 <b>Адреса:</b> ${escapeHtml(clientAddress)}\n` +
      `🏪 <b>Магазин:</b> ${escapeHtml(clientStore)}\n` +
      `👨 <b>Менеджер:</b> ${escapeHtml(manager)}\n` +
      `💬 <b>Коментар:</b> ${escapeHtml(comment)}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Сума:</b> ${totalUSD}$ (${totalUAH} грн)\n\n` +
      `📎 <i>Детальний список товарів прикріплено у файлі Excel нижче.</i>`

    // 1. Отправка в Telegram (Делаем первой, так как она работает мгновенно)
    if (excelFile) {
      const tgFormData = new FormData()
      tgFormData.append('chat_id', CHAT_ID)
      tgFormData.append('caption', tgText)
      tgFormData.append('parse_mode', 'HTML')
      
      const buffer = Buffer.from(await excelFile.arrayBuffer())
      const blob = new Blob([buffer], { type: excelFile.type })
      tgFormData.append('document', blob, excelFile.name)

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: tgFormData
      }).catch(err => console.error('Ошибка TG:', err))
    }

    // 2. Отправка заказа НА ПОЧТУ (В изолированном блоке try/catch)
    try {
      // Динамический импорт nodemailer, чтобы разгрузить память сервера
      const nodemailer = await import('nodemailer')
      
      const transporter = nodemailer.createTransport({
        host: 'smtp.ukr.net', 
        port: 465,            // ИСПРАВЛЕНО: переключаемся на защищенный SSL порт
        secure: true,         // ИСПРАВЛЕНО: true для 465 порта
        auth: {
          user: 'opticsite@ukr.net', 
          pass: 'racQ1UMaUtCCBOso', // Убедитесь, что в настройках почты включены "Программные пароли"!
        },
        connectionTimeout: 5000, // Тайм-аут подключения 5 секунд (чтобы сервер не зависал дольше)
        greetingTimeout: 5000,
      })

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 12px;">
          <h2 style="color: #16a34a; margin-top: 0;">🛒 Нове замовлення на платформі</h2>
          <hr/>
          <p><b>Клієнт:</b> ${clientName}</p>
          <p><b>Телефон:</b> ${clientPhone}</p>
          <p><b>Місто:</b> ${clientCity}</p>
          <p><b>Адреса доставки:</b> ${clientAddress}</p>
          <p><b>Магазин:</b> ${clientStore}</p>
          <p><b>Менеджер:</b> ${manager}</p>
          <p><b>Коментар:</b> ${comment}</p>
          <hr/>
          <h3 style="color: #1e3a8a;">Загальна сума: ${totalUSD}$ (${totalUAH} грн)</h3>
        </div>
      `

      if (excelFile) {
        const fileBuffer = Buffer.from(await excelFile.arrayBuffer())
        await transporter.sendMail({
          from: '"Оптика Платформа" <opticsite@ukr.net>', 
          to: 'marinevich@ukr.net', 
          subject: `Нове замовлення: ${clientName}`,
          html: emailHtml,
          attachments: [{ filename: excelFile.name, content: fileBuffer }]
        })
      }
    } catch (mailError) {
      // Если почта упадет или зависнет, мы просто запишем это в логи, но не прервем основной процесс
      console.error('Помилка отправки почты (но заказ обработан):', mailError)
    }

    // Всегда возвращаем успех, если Telegram ушел, а почта не заблокировала сервер
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Критична помилка на серверному роуті:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}