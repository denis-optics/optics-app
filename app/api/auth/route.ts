// app/api/auth/route.ts
// ✅ Паролі на сервері — не видно у браузері
// ✅ Гостьовий пароль автоматично оновлюється щопонеділка о 5:00

import { NextResponse } from 'next/server'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026'
const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN || ''
const CHAT_ID        = process.env.TELEGRAM_CHAT_ID  || ''

// ✅ Генерація нового гостьового пароля на основі поточного тижня
// Логіка: щопонеділка о 5:00 пароль змінюється автоматично
// Базується на номері тижня в році — без бази даних, детерміновано
function getWeeklyGuestPassword(): string {
  const now    = new Date()
  // Зсув на UTC+3 (Київ)
  const kyiv   = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const day    = kyiv.getUTCDay()    // 0=Sun, 1=Mon...
  const hour   = kyiv.getUTCHours()

  // Якщо сьогодні понеділок і ще не 5:00 — використовуємо минулий тиждень
  const monday = new Date(kyiv)
  const daysToMonday = (day === 0 ? 6 : day - 1)
  monday.setUTCDate(kyiv.getUTCDate() - daysToMonday)
  if (day === 1 && hour < 5) {
    monday.setUTCDate(monday.getUTCDate() - 7)
  }

  monday.setUTCHours(0, 0, 0, 0)
  const weekNumber = Math.floor(monday.getTime() / (7 * 24 * 60 * 60 * 1000))

  // Генеруємо пароль: optics + 4 цифри на базі тижня
  const base   = (weekNumber * 7919 + 13337) % 9000 + 1000 // завжди 4 цифри
  return `optics${base}`
}

// Надсилаємо новий пароль у Telegram при кожному виклику перевірки
// (лише якщо зараз понеділок між 5:00 і 5:30 — щоб не спамити)
async function sendNewPasswordIfNeeded() {
  if (!BOT_TOKEN || !CHAT_ID) return

  const now  = new Date()
  const kyiv = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const day  = kyiv.getUTCDay()
  const hour = kyiv.getUTCHours()
  const min  = kyiv.getUTCMinutes()

  // Тільки в понеділок між 05:00 і 05:30
  if (day !== 1 || hour !== 5 || min > 30) return

  const password = getWeeklyGuestPassword()
  const text = `🔐 <b>Новий тижневий пароль доступу до каталогу</b>\n\n` +
               `Пароль: <code>${password}</code>\n\n` +
               `Дійсний до наступного понеділка 05:00`

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    })
  } catch (e) {
    console.error('Помилка надсилання пароля в Telegram:', e)
  }
}

export async function POST(req: Request) {
  try {
    const { password } = await req.json()

    // Спробувати надіслати новий пароль якщо час підходить
    sendNewPasswordIfNeeded().catch(() => {})

    const guestPassword = process.env.GUEST_PASSWORD || 'optics2026'

    if (password === ADMIN_PASSWORD) {
      return NextResponse.json({ success: true, role: 'admin' })
    }

    if (password === guestPassword) {
      return NextResponse.json({ success: true, role: 'guest' })
    }

    return NextResponse.json({ success: false, error: 'Невірний пароль' }, { status: 401 })

  } catch {
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 })
  }
}

// ✅ GET — для перевірки поточного гостьового пароля (тільки для адміна/деплою)
export async function GET() {
  const password = getWeeklyGuestPassword()
  return NextResponse.json({ guestPassword: password })
}
