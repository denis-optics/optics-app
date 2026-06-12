// app/lib/generateExcel.ts
// npm install exceljs

import ExcelJS from 'exceljs'
import sharp from 'sharp'
import { imageSize } from 'image-size'
type CartItem = {
  brand: string
  name: string
  quantity: number
  price: number
  image?: string
}

type OrderData = {
  clientName: string
  clientPhone: string
  clientCity: string
  clientAddress: string
  clientStore: string
  manager: string
  comment: string
  totalUSD: number
  totalUAH: number
  currentRate: number
  markup: number
  cart: CartItem[]
}

// ✅ Завантаження фото з таймаутом
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    console.log('FETCH:', url)

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000)
    })

    if (!res.ok) {
      console.log('FAILED:', url)
      return null
    }

    const arrayBuffer = await res.arrayBuffer()

    const optimizedBuffer = await sharp(Buffer.from(arrayBuffer))
      .resize({
        width: 200,
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 25,
      })
      .toBuffer()

    console.log('SUCCESS:', url)

    return optimizedBuffer

  } catch (err) {
    console.log('ERROR:', url, err)
    return null
  }
}

function getExt(url: string): 'jpeg' | 'png' | 'gif' {
  if (url.includes('.png')) return 'png'
  if (url.includes('.gif')) return 'gif'
  return 'jpeg'
}

// ✅ Завантажуємо фото паралельно з обмеженням — щоб не зависало
async function fetchImagesLimited(
  items: CartItem[],
  concurrency = 5
): Promise<(Buffer | null)[]> {
  const results: (Buffer | null)[] = new Array(items.length).fill(null)
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const buffers = await Promise.all(
      batch.map(item => item.image ? fetchImageBuffer(item.image) : Promise.resolve(null))
    )
    buffers.forEach((buf, j) => { results[i + j] = buf })
  }
  return results
}

export async function generateExcelBuffer(order: OrderData): Promise<Buffer> {
  const workbook  = new ExcelJS.Workbook()
  const ws        = workbook.addWorksheet('Замовлення', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  })

  // ============================================================
  // КОЛЬОРИ
  // ============================================================
  const C = {
    blue:      '1E3A5F',
    blueLight: '2563EB',
    white:     'FFFFFF',
    infoBg:    'EFF6FF',
    infoVal:   'F8FAFC',
    alt:       'F0F9FF',
    totalBg:   'DCFCE7',
    totalTxt:  '166534',
    green:     '16A34A',
    border:    'CBD5E1',
    gray:      '374151',
  }

  const thin: Partial<ExcelJS.Borders> = {
    top:    { style: 'thin',   color: { argb: C.border } },
    left:   { style: 'thin',   color: { argb: C.border } },
    bottom: { style: 'thin',   color: { argb: C.border } },
    right:  { style: 'thin',   color: { argb: C.border } },
  }
  const thick: Partial<ExcelJS.Borders> = {
    top:    { style: 'medium', color: { argb: C.blue } },
    left:   { style: 'medium', color: { argb: C.blue } },
    bottom: { style: 'medium', color: { argb: C.blue } },
    right:  { style: 'medium', color: { argb: C.blue } },
  }

  // ============================================================
  // КОЛОНКИ — новий порядок без розміру/кольорів
  // №, Колекція, Артикул, Фото, К-сть, Ціна $, Сума $, Ціна грн, Сума грн
  // ============================================================
  ws.columns = [
    { key: 'num',      width: 4  },  // A — №
    { key: 'brand',    width: 18 },  // B — Колекція
    { key: 'name',     width: 24 },  // C — Артикул
    { key: 'photo',    width: 10 },  // D — Фото
    { key: 'qty',      width: 6  },  // E — К-сть
    { key: 'priceUSD', width: 9  },  // F — Ціна $
    { key: 'sumUSD',   width: 10 },  // G — Сума $
    { key: 'priceUAH', width: 11 },  // H — Ціна грн
    { key: 'sumUAH',   width: 12 },  // I — Сума грн
  ]
  const COLS = 9 // кількість колонок
  const lastCol = 'I'

  // ============================================================
  // РЯД 1: ЗАГОЛОВОК з логотипами
  // ============================================================
  ws.mergeCells(`A1:C1`)
  const titleCell     = ws.getCell('A1')
  titleCell.value     = 'ЗАМОВЛЕННЯ'
  titleCell.font      = { name: 'Calibri', size: 16, bold: true, color: { argb: C.white } }
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.blueLight } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.border    = thick

  // ✅ Логотипи INVU, STYLE MARK, PERSONA — завантажуємо паралельно
  const logoUrls: Record<string, string> = {
    INVU:       '/images/logo-invu.png',
    'STYLE MARK': '/images/logo-stylemark.png',
    PERSONA:    '/images/logo-persona.png',
  }

  // Спроба завантажити логотипи (якщо недоступні — пишемо текст)
  ws.mergeCells('D1:F1')
  ws.mergeCells('G1:I1')

  // Назви брендів як текст (якщо логотипи не підтягнуться — все одно буде красиво)
  const brandCell      = ws.getCell('D1')
  brandCell.value      = 'INVU  ·  STYLE MARK  ·  PERSONA'
  brandCell.font       = { name: 'Calibri', size: 11, bold: true, color: { argb: C.blue } }
  brandCell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.infoBg } }
  brandCell.alignment  = { horizontal: 'center', vertical: 'middle' }
  brandCell.border     = thick

  const dateCell2      = ws.getCell('G1')
  dateCell2.value      = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })
  dateCell2.font       = { name: 'Calibri', size: 10, italic: true, color: { argb: C.gray } }
  dateCell2.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.infoVal } }
  dateCell2.alignment  = { horizontal: 'center', vertical: 'middle' }
  dateCell2.border     = thick

  ws.getRow(1).height = 28

  // ============================================================
  // ✅ КОМПАКТНА ШАПКА — 4 рядки замість 7
  // Рядок 2: Клієнт + Телефон | Рядок 3: Місто + Магазин
  // Рядок 4: Адреса           | Рядок 5: Менеджер + Коментар
  // ============================================================
  const infoGroups: [string, string, string, string][] = [
    // [labelA, valueA, labelB, valueB]
    ['👤 Клієнт',   order.clientName    || '—', '📞 Телефон',  order.clientPhone   || '—'],
    ['🏙 Місто',    order.clientCity    || '—', '🏪 Магазин',  order.clientStore   || '—'],
    ['📦 Адреса',   order.clientAddress || '—', '👨 Менеджер', order.manager       || '—'],
    ['💬 Коментар', order.comment       || '—', '',            ''],
  ]

  infoGroups.forEach(([la, va, lb, vb]) => {
    const row = ws.addRow([])
    row.height = 18

    // Ліва пара
    ws.mergeCells(`A${row.number}:B${row.number}`)
    ws.mergeCells(`C${row.number}:D${row.number}`)
    const lc     = ws.getCell(`A${row.number}`)
    const vc     = ws.getCell(`C${row.number}`)
    lc.value     = la
    lc.font      = { name: 'Calibri', size: 9, bold: true, color: { argb: C.gray } }
    lc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.infoBg } }
    lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    lc.border    = thin
    vc.value     = va
    vc.font      = { name: 'Calibri', size: 9, color: { argb: C.blue } }
    vc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } }
    vc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    vc.border    = thin

    // Права пара (якщо є)
    if (lb) {
      ws.mergeCells(`E${row.number}:F${row.number}`)
      ws.mergeCells(`G${row.number}:${lastCol}${row.number}`)
      const lc2     = ws.getCell(`E${row.number}`)
      const vc2     = ws.getCell(`G${row.number}`)
      lc2.value     = lb
      lc2.font      = { name: 'Calibri', size: 9, bold: true, color: { argb: C.gray } }
      lc2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.infoBg } }
      lc2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      lc2.border    = thin
      vc2.value     = vb
      vc2.font      = { name: 'Calibri', size: 9, color: { argb: C.blue } }
      vc2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } }
      vc2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      vc2.border    = thin
    } else {
      // Коментар на всю ширину
      ws.mergeCells(`E${row.number}:${lastCol}${row.number}`)
      const vc2     = ws.getCell(`E${row.number}`)
      vc2.value     = ''
      vc2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } }
      vc2.border    = thin
    }
  })

  // ============================================================
  // ЗАГОЛОВОК ТАБЛИЦІ
  // №, Колекція, Артикул, Фото, К-сть, Ціна $, Сума $, Ціна грн, Сума грн
  // ============================================================
  const headerRow = ws.addRow([
    '№', 'Колекція', 'Артикул', 'Фото',
    'К-сть', 'Ціна $', 'Сума $', 'Ціна грн', 'Сума грн'
  ])
  headerRow.height = 22
  headerRow.eachCell(cell => {
    cell.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.blue } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
    cell.border    = thick
  })

  // ============================================================
  // ✅ ЗАВАНТАЖЕННЯ ФОТО З ОБМЕЖЕННЯМ (не зависає)
  // ============================================================
  const imageBuffers = await fetchImagesLimited(order.cart, 5)

  // ============================================================
  // РЯДКИ ТОВАРІВ — компактні, шрифт 8
  // ============================================================
  const IMG_HEIGHT = 32 // висота рядка в два рази менша ніж раніше

  for (let i = 0; i < order.cart.length; i++) {
    const item     = order.cart[i]
   console.log('PRODUCT:', item.name)
  console.log('IMAGE:', item.image)
    const imgBuf   = imageBuffers[i]
    const isAlt    = i % 2 === 1
    const bgColor  = isAlt ? C.alt : 'FFFFFF'
    const priceUAH = item.price > 0 ? item.price * order.currentRate * order.markup : 0
    const sumUAH   = priceUAH * item.quantity
    const sumUSD   = item.price * item.quantity

    const row = ws.addRow([
      i + 1,          // A — №
      item.brand,     // B — Колекція
      item.name,      // C — Артикул
      '',             // D — Фото (вставимо зображення)
      item.quantity,  // E — К-сть
      item.price > 0 ? +item.price.toFixed(2)        : 'уточн.', // F — Ціна $
      item.price > 0 ? +sumUSD.toFixed(2)            : '—',      // G — Сума $
      item.price > 0 ? +priceUAH.toFixed(2)         : '—',      // H — Ціна грн
      item.price > 0 ? +sumUAH.toFixed(2)         : '—',      // I — Сума грн
    ])

    row.height = IMG_HEIGHT

    row.eachCell((cell, col) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.font      = { name: 'Calibri', size: 9 }
      cell.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'center' : 'left' }
      cell.border    = thin
    })

    // Числові колонки — вирівнювання вправо
    ;[5, 6, 7, 8, 9].forEach(col => {
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' }
    })
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' } // К-сть — центр

    // Сума грн — зелений жирний
    row.getCell(9).font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.green } }

    // ✅ ВСТАВКА ФОТО
  if (imgBuf) {
  try {

    const dimensions = imageSize(imgBuf)

    const originalWidth = dimensions.width || 100
    const originalHeight = dimensions.height || 100

    const maxWidth = 55
    const maxHeight = 40

    const ratio = Math.min(
      maxWidth / originalWidth,
      maxHeight / originalHeight
    )

    const width = originalWidth * ratio
    const height = originalHeight * ratio

    const imageId = workbook.addImage({
      buffer: imgBuf as any,
      extension: 'jpeg',
    })

    ws.addImage(imageId, {
      tl: {
        col: 3.15,
        row: row.number - 0.85,
      },
      ext: {
        width,
        height,
      },
    })

  } catch (err) {
    console.error('IMAGE ERROR:', item.name, err)
  }
}
  }
  // ============================================================
  // ПІДСУМОК
  // ============================================================
  ws.addRow([])

  const totalQty = order.cart.reduce((s, i) => s + i.quantity, 0)
  const totalRow = ws.addRow([
    '', '', 'РАЗОМ:', '',
    totalQty,
   '',
    order.totalUSD.toFixed(2) + '$',
    '',
    order.totalUAH.toFixed(2) + ' грн',
  ])
  totalRow.height = 22
  totalRow.eachCell((cell, col) => {
    if (col >= 3) {
      cell.font      = { name: 'Calibri', size: 12, bold: true, color: { argb: C.totalTxt } }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.totalBg } }
      cell.alignment = { horizontal: col === 3 ? 'center' : 'center', vertical: 'middle' }
      cell.border    = thick
    }
  })
  totalRow.getCell(9).font      = { name: 'Calibri', size: 12, bold: true, color: { argb: C.totalTxt } }
  totalRow.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' }

  // ============================================================
  // ✅ АВТОШИРИНА КОЛОНОК на основі вмісту
  // ============================================================
  ws.columns.forEach(column => {
    if (!column || !column.eachCell) return
    let maxLen = (column.header as string || '').length
    column.eachCell({ includeEmpty: false }, cell => {
      const val = cell.value?.toString() || ''
      if (val.length > maxLen) maxLen = val.length
    })
    // Мін ширина 5, макс 35 щоб не розтягувалось
    column.width = Math.min(15, Math.max(5, maxLen + 2))
  })

  // Фото колонка — фіксована ширина
  ws.getColumn('D').width = 8

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
