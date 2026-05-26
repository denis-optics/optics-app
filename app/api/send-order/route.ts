import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  try {
    // Принимаем FormData вместо JSON
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
    
    // Извлекаем прикрепленный файл Excel
    const excelFile = formData.get('excelFile') as File | null

    // Настройки Telegram бота (Укажите ID вашей группы!)
    const BOT_TOKEN = '8902109006:AAFc8yDh3qUME30aUtIXHqSbgj1XJjKcq0w'
    const CHAT_ID = '-100220058690' 

    // 1. Форматируем лаконичную ШАПКУ для Telegram (без простыни товаров)
    const tgText = `<b>🛒 НОВЕ ЗАМОВЛЕННЯ</b>\n\n` +
      `👤 <b>Клієнт:</b> ${clientName}\n` +
      `📞 <b>Телефон:</b> ${clientPhone}\n` +
      `🏙 <b>Місто:</b> ${clientCity}\n` +
      `📦 <b>Адреса:</b> ${clientAddress}\n` +
      `🏪 <b>Магазин:</b> ${clientStore}\n` +
      `👨 <b>Менеджер:</b> ${manager}\n` +
      `💬 <b>Коментар:</b> ${comment}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Сума:</b> ${totalUSD}$ (${totalUAH} грн)\n\n` +
      `📎 <i>Детальний список товарів прикріплено у файлі Excel нижче.</i>`

    // 2. Отправка документа в Telegram через sendDocument
    if (excelFile) {
      const tgFormData = new FormData()
      tgFormData.append('chat_id', CHAT_ID)
      tgFormData.append('caption', tgText)
      tgFormData.append('parse_mode', 'HTML')
      
      // Превращаем File в Blob для корректной передачи в Telegram API
      const buffer = Buffer.from(await excelFile.arrayBuffer())
      const blob = new Blob([buffer], { type: excelFile.type })
      tgFormData.append('document', blob, excelFile.name)

      const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: tgFormData
      })

      if (!tgResponse.ok) {
        const errLog = await tgResponse.json().catch(() => ({}))
        console.error('Помилка отправки документа в Telegram:', errLog)
      }
    }

    // 3. Отправка заказа НА ПОЧТУ (Email) через Nodemailer
    // НАСТРОЙТЕ СВОИ ДАННЫЕ SMTP ТУТ:
    const transporter = nodemailer.createTransport({
      host: 'smtp.ukr.ua', // Ваш SMTP сервер (например, smtp.gmail.com)
      port: 465,            // Порт (обычно 465 или 587)
      secure: true,
      auth: {
        user: 'opticsite@ukr.ua',     // Логин вашей почты отправителя
        pass: 'pw9B85ZX9dN3sAJn',  // Пароль приложения (App Password)
      },
    })

    // HTML-текст для письма
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #ddd; padding: 20px; rounded: 12px;">
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
        <p style="font-size: 12px; color: #666;">Повний перелік замовлених моделей знаходиться у вкладеному файлі Excel.</p>
      </div>
    `

    if (excelFile) {
      const fileBuffer = Buffer.from(await excelFile.arrayBuffer())
      
      await transporter.sendMail({
        from: '"Оптика Платформа" <ваша_почта@meta.ua>', 
        to: 'marinevich@ukr.com', // Email администратора или менеджера
        subject: `Нове замовлення: ${clientName}`,
        html: emailHtml,
        attachments: [
          {
            filename: excelFile.name,
            content: fileBuffer,
          }
        ]
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Критична помилка на серверному роуті:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}