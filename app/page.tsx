'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// ============================================================
// ТИПИ
// ============================================================
type Product = {
  id: number
  name: string
  price: number
  stock: number
  description: string
  image: string
  brand: string
  promo: boolean
  sizes: string
  frameColor: string
  lensColor: string
  category: string
}

type CartItem = Product & { quantity: number }

type OrderRecord = {
  id: string
  date: string
  clientName: string
  clientPhone: string
  clientCity: string
  clientStore: string
  manager: string
  totalUSD: string
  totalUAH: string
  items: { name: string; brand: string; qty: number; price: number }[]
}

// ============================================================
// КОНСТАНТИ
// ============================================================
const DEFAULT_FALLBACK_RATE = 44.20
const MARKUP = 1.02
const START_BACKGROUND = '/images/background.jpg'

// ✅ Тільки логотипи — без підписів
const BRAND_LOGOS: Record<string, string> = {
  'INVU':       '/images/logo-invu.png',
  'STYLE MARK': '/images/logo-stylemark.png',
  'PERSONA':    '/images/logo-persona.png',
}

const MENU = [
  {
    brand: 'INVU',
    submenu: [
      'INVU ACTIVITY', 'INVU CLASSIC', 'INVU PREMIUM',
      'INVU KIDS', 'INVU TRENDY', 'INVU FRAME', 'INVU CLIP-ON'
    ]
  },
  {
    brand: 'STYLE MARK',
    submenu: ['STYLE MARK', 'STYLE MARK CLIP-ON']
  },
  {
    brand: 'PERSONA',
    submenu: ['PERSONA FRAME']
  },
]

const SHEETS_ID = '1gFtRzDVggVbSuzkZtiCs8KAqDV2u-5oCBWxDltFi_7g'

// ============================================================
// ✅ КОМПОНЕНТ КАРТКИ ТОВАРУ — оновлений
// ============================================================
function ProductCard({
  product,
  isInCart,
  currentQty,
  currentRate,
  onToggleCart,
  onIncrease,
  onDecrease,
  onUpdateQty,
  onZoomImage,
}: {
  product: Product
  isInCart: boolean
  currentQty: number
  currentRate: number
  onToggleCart: () => void
  onIncrease: () => void
  onDecrease: () => void
  onUpdateQty: (qty: number) => void
  onZoomImage: (src: string) => void
}) {
  const isOutOfStock = product.stock === 0

  const renderStock = (stock: number) => {
    if (stock === 0) return <span className="text-red-600 font-black text-sm">немає</span>
    if (stock > 5)   return <span className="text-emerald-700 font-black text-sm">&gt; 5 шт</span>
    return <span className="text-amber-700 font-black text-sm">{stock} шт</span>
  }

  return (
    <div className={`border-2 border-gray-300 rounded-2xl p-4 shadow-md relative flex flex-col justify-between transition-all duration-200 hover:border-gray-400 ${isOutOfStock ? 'opacity-60 bg-gray-200' : 'bg-gray-100'}`}>

      {product.promo && (
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded z-10">% АКЦІЯ</div>
      )}

      {/* ФОТО */}
      <div className="h-[175px] flex items-center justify-center bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onClick={() => onZoomImage(product.image)}
            className={`max-h-full object-contain cursor-pointer hover:scale-105 transition duration-200 ${isOutOfStock ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="w-full h-full bg-white rounded-xl flex items-center justify-center text-gray-300 text-xs">Фото відсутнє</div>
        )}
      </div>

      {/* ✅ ІНФО — назва + колекція + три характеристики */}
      <div className="mt-3 space-y-1.5">

        {/* Назва артикулу */}
        <h2 className="font-black line-clamp-1 text-sm sm:text-base text-gray-950 tracking-tight">
          {product.name}
        </h2>

        {/* ✅ Назва колекції (замість бренду і серії) */}
        {product.category && (
          <div className="inline-block bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-black px-2 py-0.5 rounded-full">
            {product.category}
          </div>
        )}

        {/* ✅ Три характеристики */}
        <div className="grid grid-cols-1 gap-1 mt-1">

          {/* Розмір */}
          <div className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-gray-200">
            <span className="text-[11px] text-gray-500 font-bold">📐 Розмір</span>
            <span className="text-[11px] font-black text-gray-900">{product.sizes || '—'}</span>
          </div>

          {/* Колір оправи */}
          <div className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-gray-200">
            <span className="text-[11px] text-gray-500 font-bold">🕶 Оправа</span>
            <span className="text-[11px] font-black text-gray-900">{product.frameColor || '—'}</span>
          </div>

          {/* Колір лінзи */}
          <div className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-gray-200">
            <span className="text-[11px] text-gray-500 font-bold">🔵 Лінза</span>
            <span className="text-[11px] font-black text-gray-900">{product.lensColor || '—'}</span>
          </div>

        </div>
      </div>

      {/* ЦІНА + КІЛЬКІСТЬ + КНОПКА */}
      <div className="mt-3 pt-3 border-t-2 border-gray-300">
        <div className="flex items-center justify-between gap-1 mb-2">
          {product.price > 0 ? (
            <>
              <span className="text-gray-950 font-black text-sm bg-gray-200 px-2 py-0.5 rounded border border-gray-300">({product.price} $)</span>
              <span className="text-emerald-800 font-black text-base sm:text-lg">{(product.price * currentRate * MARKUP).toFixed(2)} грн</span>
            </>
          ) : (
            <span className="text-amber-700 text-sm font-black uppercase">ціну уточнюйте</span>
          )}
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border-2 border-gray-300">
          <button disabled={isOutOfStock} onClick={onDecrease} className="w-10 h-10 bg-gray-100 rounded-lg font-black hover:bg-gray-300 transition disabled:opacity-30 flex items-center justify-center text-lg border border-gray-300">−</button>
          <input
            type="number"
            disabled={isOutOfStock}
            value={isOutOfStock ? 0 : currentQty}
            onChange={(e) => onUpdateQty(parseInt(e.target.value) || 1)}
            className="w-10 text-center font-black bg-transparent text-sm focus:outline-none disabled:text-gray-400"
          />
          <button disabled={isOutOfStock} onClick={onIncrease} className="w-10 h-10 bg-gray-100 rounded-lg font-black hover:bg-gray-300 transition disabled:opacity-30 flex items-center justify-center text-lg border border-gray-300">+</button>
          <div className="ml-auto pr-1">{renderStock(product.stock)}</div>
        </div>

        <button
          disabled={isOutOfStock}
          onClick={onToggleCart}
          className={`mt-3 px-4 py-2.5 rounded-xl w-full text-white font-black transition text-sm shadow-md ${
            isOutOfStock ? 'bg-gray-400 cursor-not-allowed shadow-none'
            : isInCart   ? 'bg-red-600 hover:bg-red-700'
                         : 'bg-blue-700 hover:bg-blue-800'
          }`}
        >
          {isOutOfStock ? 'Немає в наявності' : isInCart ? 'Прибрати з кошика' : 'Обрати модель'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// ГОЛОВНИЙ КОМПОНЕНТ
// ============================================================
export default function Page() {
  const [authorized, setAuthorized]   = useState(false)
  const [role, setRole]               = useState<'admin' | 'guest' | null>(null)
  const [password, setPassword]       = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError]     = useState('')

  const [products, setProducts]     = useState<Product[]>([])
  const [cart, setCart]             = useState<CartItem[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})

  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const [activeBrand,    setActiveBrand]    = useState<string>('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [openSubmenu,    setOpenSubmenu]    = useState<string>('')

  const [search, setSearch]                     = useState('')
  const [debouncedSearch, setDebouncedSearch]   = useState('')

  const [currentRate, setCurrentRate]     = useState<number>(DEFAULT_FALLBACK_RATE)
  const [rateDate, setRateDate]           = useState<string>('')
  const [isRateLoading, setIsRateLoading] = useState(true)

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  const [showCheckout, setShowCheckout] = useState(false)
  const [showPreview,  setShowPreview]  = useState(false)
  const [clientName,    setClientName]    = useState('')
  const [clientPhone,   setClientPhone]   = useState('')
  const [clientCity,    setClientCity]    = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientStore,   setClientStore]   = useState('')
  const [manager,       setManager]       = useState('')
  const [comment,       setComment]       = useState('')

  const [showHistory,   setShowHistory]   = useState(false)
  const [orderHistory,  setOrderHistory]  = useState<OrderRecord[]>([])

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenSubmenu('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    try {
      const auth = sessionStorage.getItem('optics_auth')
      const r    = sessionStorage.getItem('optics_role')
      if (auth === 'true' && r) { setAuthorized(true); setRole(r as 'admin' | 'guest') }
      const c = localStorage.getItem('optics_cart')
      const q = localStorage.getItem('optics_quantities')
      if (c) setCart(JSON.parse(c))
      if (q) setQuantities(JSON.parse(q))
      const h = localStorage.getItem('optics_order_history')
      if (h) setOrderHistory(JSON.parse(h))
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem('optics_cart', JSON.stringify(cart))
    localStorage.setItem('optics_quantities', JSON.stringify(quantities))
  }, [cart, quantities])

  useEffect(() => {
    localStorage.setItem('optics_order_history', JSON.stringify(orderHistory))
  }, [orderHistory])

  useEffect(() => {
    fetch(`https://opensheet.elk.sh/${SHEETS_ID}/Course`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        if (data?.length > 0) {
          const v = data[0]['Курс'] || data[0]['курс'] || data[0]['Rate'] || Object.values(data[0])[0]
          if (v) {
            const n = parseFloat(String(v).replace(/\s+/g, '').replace(',', '.'))
            if (!isNaN(n) && n > 0) setCurrentRate(n)
          }
          const d = data[1] ? (Object.values(data[1])[0] || Object.values(data[0])[1]) : null
          if (d && String(d).includes('.')) setRateDate(String(d))
        }
        setIsRateLoading(false)
      })
      .catch(() => setIsRateLoading(false))
  }, [])

  useEffect(() => {
    fetch(`https://opensheet.elk.sh/${SHEETS_ID}/Sheet1`)
      .then(r => r.json())
      .then((data) => {
        const formatted: Product[] = data.map((item: any, index: number) => {
          const p = parseFloat(String(item['Цена'] || '0').replace(/\s+/g, '').replace(',', '.'))
          return {
            id:          index,
            name:        item['Название']        || 'Без назви',
            price:       isNaN(p) || p <= 0 ? 0 : p,
            stock:       Number(item['Остаток']  || 0),
            description: item['Описание']        || '',
            image:       item['image']?.trim()   || '',
            brand:       item['Торговая марка']  || '',
            promo:       String(item['Акция']    || '').toLowerCase().includes('ак'),
            // ✅ Три нові поля з Excel
            sizes:       item['Розмір']          || item['Размеры'] || '—',
            frameColor:  item['Колір оправи']    || '',
            lensColor:   item['Колір лінзи']     || '',
            // Категорія = назва колекції
            category:    item['Категорія']       || item['Торговая марка'] || '',
          }
        })
        setProducts(formatted)
        setActiveBrand(MENU[0].brand)
        setActiveCategory(MENU[0].submenu[0] || MENU[0].brand)
      })
      .catch(err => console.error('Помилка товарів:', err))
  }, [])

  const handleAuth = async (inputPass: string) => {
    if (!inputPass.trim()) return
    setAuthLoading(true)
    setAuthError('')
    try {
      const res  = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: inputPass })
      })
      const data = await res.json()
      if (data.success) {
        setRole(data.role)
        setAuthorized(true)
        sessionStorage.setItem('optics_auth', 'true')
        sessionStorage.setItem('optics_role', data.role)
      } else {
        setAuthError('Невірний пароль. Спробуйте ще раз.')
      }
    } catch {
      setAuthError("Помилка з'єднання з сервером.")
    } finally {
      setAuthLoading(false)
    }
  }

  const updateQuantity = (id: number, newQty: number) => {
    const p = products.find(p => p.id === id)
    if (!p) return
    const q = Math.max(1, Math.min(newQty, p.stock))
    setQuantities(prev => ({ ...prev, [id]: q }))
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: q } : item))
  }

  const increaseQty = (id: number) => updateQuantity(id, (quantities[id] || 1) + 1)
  const decreaseQty = (id: number) => updateQuantity(id, (quantities[id] || 1) - 1)

  const toggleCart = (product: Product) => {
    const qty = quantities[product.id] || 1
    if (cart.find(p => p.id === product.id)) {
      setCart(cart.filter(p => p.id !== product.id))
    } else {
      setCart([...cart, { ...product, quantity: qty }])
    }
  }

  const removeFromCart = (id: number) => {
    setCart(cart.filter(p => p.id !== id))
    setQuantities(prev => { const u = { ...prev }; delete u[id]; return u })
  }

  const clearCart = () => {
    if (confirm('Очистити весь кошик?')) { setCart([]); setQuantities({}) }
  }

  const { totalItems, totalPriceUAH, totalPriceUSD } = useMemo(() =>
    cart.reduce((acc, item) => {
      acc.totalItems    += item.quantity
      acc.totalPriceUSD += item.price * item.quantity
      acc.totalPriceUAH += item.price * currentRate * MARKUP * item.quantity
      return acc
    }, { totalItems: 0, totalPriceUAH: 0, totalPriceUSD: 0 }),
  [cart, currentRate])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (debouncedSearch.trim() !== '') {
        const s = debouncedSearch.toLowerCase()
        return p.name.toLowerCase().includes(s) ||
               p.brand.toLowerCase().includes(s) ||
               p.category.toLowerCase().includes(s) ||
               p.sizes.toLowerCase().includes(s) ||
               p.frameColor.toLowerCase().includes(s) ||
               p.lensColor.toLowerCase().includes(s)
      }
      if (activeCategory) return p.category === activeCategory && p.stock > 0
      return p.brand === activeBrand && p.stock > 0
    })
  }, [products, activeBrand, activeCategory, debouncedSearch])

  const generateExcelBlob = () => {
    const rows: any[] = [
      ['ПІБ клієнта', clientName || '—'],
      ['Телефон',     clientPhone || '—'],
      ['Місто',       clientCity  || '—'],
      ['Адреса',      clientAddress || '—'],
      ['Магазин',     clientStore || '—'],
      ['Менеджер',    manager     || '—'],
      ['Коментар',    comment     || '—'],
      ['Дата',        new Date().toLocaleDateString('uk-UA')],
      [],
      ['Колекція','Артикул','Розмір','Колір оправи','Колір лінзи','Кількість','Ціна $','Ціна грн','Сума $','Сума грн']
    ]
    cart.forEach(p => {
      const h = p.price > 0
      rows.push([
        p.category || p.brand, p.name,
        p.sizes, p.frameColor || '—', p.lensColor || '—',
        String(p.quantity),
        h ? p.price.toFixed(2) : 'Уточнюйте',
        h ? (p.price * currentRate * MARKUP).toFixed(2) : '—',
        h ? (p.price * p.quantity).toFixed(2) : '—',
        h ? (p.price * currentRate * MARKUP * p.quantity).toFixed(2) : '—'
      ])
    })
    rows.push([], ['Разом','','','','', String(totalItems),'','',totalPriceUSD.toFixed(2), totalPriceUAH.toFixed(2)])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Замовлення')
    return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  const sendOrder = async () => {
    if (!clientName || !clientPhone) {
      alert("Заповніть обов'язкові поля (ПІБ та Телефон)")
      return
    }
    if (!confirm('Надіслати замовлення?')) return
    try {
      const blob = generateExcelBlob()
      const fd   = new FormData()
      fd.append('clientName', clientName); fd.append('clientPhone', clientPhone)
      fd.append('clientCity', clientCity); fd.append('clientAddress', clientAddress)
      fd.append('clientStore', clientStore); fd.append('manager', manager)
      fd.append('comment', comment); fd.append('totalUSD', totalPriceUSD.toFixed(2))
      fd.append('totalUAH', totalPriceUAH.toFixed(2))
      fd.append('excelFile', blob, `Order_${clientName.replace(/\s+/g, '_')}.xlsx`)
      const res = await fetch('/api/send-order', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      saveAs(blob, `zamovlennya_${clientName.replace(/\s+/g, '_')}.xlsx`)
      const newOrder: OrderRecord = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('uk-UA') + ' ' + new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        clientName, clientPhone, clientCity, clientStore, manager,
        totalUSD: totalPriceUSD.toFixed(2), totalUAH: totalPriceUAH.toFixed(2),
        items: cart.map(i => ({ name: i.name, brand: i.category || i.brand, qty: i.quantity, price: i.price }))
      }
      setOrderHistory(prev => [newOrder, ...prev])
      alert('Замовлення успішно відправлено!')
      setCart([]); setQuantities({})
      setClientName(''); setClientPhone(''); setClientCity('')
      setClientAddress(''); setClientStore(''); setComment('')
      setShowCheckout(false); setIsMobileCartOpen(false)
    } catch { alert('Помилка відправлення') }
  }

  const CartContent = () => (
    <>
      <div className="p-4 border-b flex justify-between items-center bg-white">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Замовлення</h2>
        <button onClick={() => setIsMobileCartOpen(false)} className="lg:hidden text-gray-700 font-bold text-sm px-2.5 py-1 bg-gray-200 rounded-lg hover:bg-gray-300">Згорнути</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        {cart.length === 0 ? (
          <p className="text-gray-500 text-center mt-8 text-sm">Кошик порожній</p>
        ) : cart.map(p => (
          <div key={p.id} className="flex gap-3 items-center border-b pb-3 last:border-0">
            {p.image
              ? <img src={p.image} loading="lazy" className="w-10 h-10 object-contain bg-gray-50 border-2 border-gray-200 rounded-lg flex-shrink-0 cursor-pointer" alt="" onClick={() => setSelectedImage(p.image)} />
              : <div className="w-10 h-10 bg-gray-100 border border-gray-300 rounded-lg flex-shrink-0"></div>
            }
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs line-clamp-1 text-gray-900">{p.name}</div>
              <div className="text-[10px] text-blue-600 font-bold">{p.category}</div>
              <div className="text-[10px] text-gray-500">{p.frameColor && `Оправа: ${p.frameColor}`}{p.lensColor && ` · Лінза: ${p.lensColor}`}</div>
              <div className="text-xs text-emerald-800 font-bold mt-0.5">
                {p.price > 0 ? `${(p.price * p.quantity).toFixed(2)}$` : 'Ціну уточнюйте'}
                {p.price > 0 && <span className="text-gray-600 text-[10px]"> ({(p.price * currentRate * MARKUP * p.quantity).toFixed(2)} грн)</span>}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <button onClick={() => decreaseQty(p.id)} className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-black flex items-center justify-center border border-gray-300">-</button>
                <span className="text-xs font-black w-6 text-center">{p.quantity}</span>
                <button onClick={() => increaseQty(p.id)} className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-black flex items-center justify-center border border-gray-300">+</button>
              </div>
            </div>
            <button onClick={() => removeFromCart(p.id)} className="text-red-400 hover:text-red-600 font-black text-xl flex-shrink-0 w-6 h-6 flex items-center justify-center">×</button>
          </div>
        ))}
      </div>
      <div className="p-4 border-t bg-gray-100 sticky bottom-0">
        <div className="flex justify-between text-xs sm:text-sm font-bold text-gray-700">
          <span>Всього:</span><span className="font-black">{totalItems}</span>
        </div>
        <div className="flex justify-between font-black text-sm sm:text-base mt-2 border-b border-gray-300 pb-3 items-center">
          <span>Сума:</span>
          <span className="text-emerald-800 text-right">{totalPriceUSD.toFixed(2)}$<br /><span className="text-xs text-gray-600">({totalPriceUAH.toFixed(2)} грн)</span></span>
        </div>
        {cart.length > 0 && <button onClick={clearCart} className="w-full mt-2 text-red-500 hover:text-red-700 font-bold text-xs py-1 hover:underline">🗑 Очистити кошик</button>}
        <button disabled={cart.length === 0} onClick={() => setShowPreview(true)} className="w-full mt-3 bg-gray-900 text-white py-2 rounded-xl font-bold text-xs sm:text-sm disabled:opacity-50 hover:bg-black transition">Переглянути замовлення</button>
        <button disabled={cart.length === 0} onClick={() => setShowCheckout(true)} className="w-full mt-2 bg-emerald-700 text-white py-2.5 rounded-xl disabled:opacity-50 font-black text-sm sm:text-base hover:bg-emerald-800 transition shadow-md">Зробити замовлення</button>
      </div>
    </>
  )

  if (!authorized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cover bg-center w-screen h-screen" style={{ backgroundImage: `url(${START_BACKGROUND})` }}>
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="bg-white/95 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative z-10">
          <h1 className="text-xl sm:text-2xl font-black text-gray-950 mb-1">Вхід до каталогу</h1>
          <p className="text-xs text-gray-600 font-bold mb-6">Введіть ваш пароль доступу</p>
          <input
            type="password"
            placeholder="Введіть пароль..."
            value={password}
            onChange={e => { setPassword(e.target.value); setAuthError('') }}
            onKeyDown={e => e.key === 'Enter' && handleAuth(password)}
            disabled={authLoading}
            className="w-full border-2 border-gray-300 p-3 rounded-xl text-center font-black text-gray-900 text-base mb-2 focus:border-blue-600 focus:outline-none bg-white tracking-widest disabled:opacity-50"
          />
          {authError && <p className="text-red-600 text-xs font-bold mb-3">{authError}</p>}
          <button onClick={() => handleAuth(password)} disabled={authLoading} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3 rounded-xl transition text-sm shadow-md disabled:opacity-50 mt-2">
            {authLoading ? '⏳ Перевірка...' : 'Увійти в каталог'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 bg-gray-100 min-h-screen text-black pb-24 lg:pb-6">

      {/* ВЕРХНЯ ПАНЕЛЬ */}
      <div className="sticky top-0 z-40 bg-white p-3 sm:p-4 rounded-2xl shadow mb-4 sm:mb-6 border border-gray-200 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">

          {/* ✅ МЕНЮ — тільки логотипи без підписів */}
          <div ref={menuRef} className="flex gap-2 flex-wrap items-center">
            {MENU.map(menuItem => (
              <div key={menuItem.brand} className="relative">
                <button
                  onClick={() => {
                    if (menuItem.submenu.length > 0) {
                      setOpenSubmenu(openSubmenu === menuItem.brand ? '' : menuItem.brand)
                    } else {
                      setActiveBrand(menuItem.brand)
                      setActiveCategory('')
                      setOpenSubmenu('')
                      setSearch('')
                    }
                  }}
                  className={`flex items-center justify-center px-3 py-2 rounded-xl border-2 transition ${
                    activeBrand === menuItem.brand
                      ? 'bg-blue-50 border-blue-500 shadow-md'
                      : 'bg-white border-gray-200 hover:border-blue-300'
                  }`}
                  title={menuItem.brand}
                >
                  {/* ✅ Тільки логотип — без тексту */}
                  {BRAND_LOGOS[menuItem.brand] ? (
                    <img
                      src={BRAND_LOGOS[menuItem.brand]}
                      alt={menuItem.brand}
                      className="h-7 w-auto object-contain"
                    />
                  ) : (
                    // Якщо лого ще немає — показуємо скорочену назву як запасний варіант
                    <span className="text-xs font-black text-gray-700">{menuItem.brand.split(' ')[0]}</span>
                  )}
                  {menuItem.submenu.length > 0 && (
                    <span className="text-[10px] text-gray-400 ml-1">{openSubmenu === menuItem.brand ? '▲' : '▼'}</span>
                  )}
                </button>

                {/* ПІДМЕНЮ */}
                {menuItem.submenu.length > 0 && openSubmenu === menuItem.brand && (
                  <div className="absolute top-full left-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl z-50 min-w-[220px] overflow-hidden">
                    {menuItem.submenu.map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveBrand(menuItem.brand)
                          setActiveCategory(cat)
                          setOpenSubmenu('')
                          setSearch('')
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-blue-50 transition border-b border-gray-100 last:border-0 ${
                          activeCategory === cat ? 'bg-blue-100 text-blue-700' : 'text-gray-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ПОШУК */}
          <input
            type="text"
            placeholder="Пошук: артикул, колір, розмір..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-2 border-gray-300 p-2 rounded-lg flex-1 text-sm font-medium focus:border-blue-600 focus:outline-none min-w-[180px]"
          />

          {/* КУРС */}
          <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border-2 border-gray-200 shrink-0">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-gray-900">Курс $:</span>
              <span className="text-[10px] text-gray-600 font-black">{isRateLoading ? 'Оновлення...' : `Зміна: ${rateDate || '—'}`}</span>
            </div>
            <span className="font-black text-blue-800 text-sm sm:text-lg bg-blue-50 px-2.5 py-1 rounded-lg border-2 border-blue-200">{currentRate.toFixed(2)} грн</span>
          </div>

          {role === 'admin' && (
            <button onClick={() => setShowHistory(true)} className="bg-gray-800 text-white font-bold px-3 py-2 rounded-xl text-xs hover:bg-black transition shrink-0">📋 Історія</button>
          )}
        </div>

        {/* Активна категорія */}
        {activeCategory && !search && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Показую:</span>
            <span className="bg-blue-100 text-blue-700 text-xs font-black px-3 py-1 rounded-full">{activeCategory}</span>
            <span className="text-xs text-gray-400">· {filteredProducts.length} товарів</span>
          </div>
        )}
        {search.trim() !== '' && (
          <p className="text-[11px] text-blue-700 font-bold">⚠️ Наскрізний пошук — показуються всі моделі включно з відсутніми.</p>
        )}
      </div>

      {/* КАТАЛОГ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-3 text-center py-20 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-bold">Товарів не знайдено</p>
            </div>
          ) : filteredProducts.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              isInCart={cart.some(c => c.id === p.id)}
              currentQty={quantities[p.id] || 1}
              currentRate={currentRate}
              onToggleCart={() => toggleCart(p)}
              onIncrease={() => increaseQty(p.id)}
              onDecrease={() => decreaseQty(p.id)}
              onUpdateQty={qty => updateQuantity(p.id, qty)}
              onZoomImage={setSelectedImage}
            />
          ))}
        </div>

        <div className="hidden lg:flex border-2 border-gray-200 rounded-2xl shadow bg-white sticky top-24 h-[85vh] flex-col justify-between overflow-hidden">
          <CartContent />
        </div>
      </div>

      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl p-3 z-40 flex items-center justify-between gap-4 rounded-t-2xl">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-600">Обрано: <span className="font-black">{totalItems} шт.</span></span>
            <span className="text-emerald-800 font-black text-sm">{totalPriceUSD.toFixed(2)}$ <span className="text-xs text-gray-600">({totalPriceUAH.toFixed(2)} грн)</span></span>
          </div>
          <button onClick={() => setIsMobileCartOpen(true)} className="bg-blue-700 text-white font-black px-4 py-2 rounded-xl text-xs hover:bg-blue-800">Дивитись кошик</button>
        </div>
      )}

      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl"><CartContent /></div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 cursor-pointer backdrop-blur-md" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-full bg-white p-2 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={selectedImage} className="max-w-full max-h-[82vh] object-contain rounded-xl" alt="" />
            <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 bg-black/70 text-white font-black w-9 h-9 rounded-full flex items-center justify-center hover:bg-black text-xl">×</button>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl text-black my-auto border border-gray-200">
            <h2 className="text-xl sm:text-2xl font-black mb-4 border-b-2 pb-2">Оформлення замовлення</h2>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div><label className="block text-xs font-black text-gray-800 mb-1">ПІБ КЛІЄНТА *</label><input type="text" placeholder="Повне ім'я" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full border-2 border-gray-300 p-2.5 rounded-xl text-sm focus:border-blue-600 focus:outline-none bg-white" /></div>
              <div><label className="block text-xs font-black text-gray-800 mb-1">ТЕЛЕФОН *</label><input type="text" placeholder="+380" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full border-2 border-gray-300 p-2.5 rounded-xl text-sm focus:border-blue-600 focus:outline-none bg-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-black text-gray-800 mb-1">МІСТО</label><input type="text" placeholder="Київ" value={clientCity} onChange={e => setClientCity(e.target.value)} className="w-full border-2 border-gray-300 p-2.5 rounded-xl text-sm focus:border-blue-600 focus:outline-none bg-white" /></div>
                <div><label className="block text-xs font-black text-gray-800 mb-1">МАГАЗИН</label><input type="text" placeholder="Оптика+" value={clientStore} onChange={e => setClientStore(e.target.value)} className="w-full border-2 border-gray-300 p-2.5 rounded-xl text-sm focus:border-blue-600 focus:outline-none bg-white" /></div>
              </div>
              <div><label className="block text-xs font-black text-gray-800 mb-1">АДРЕСА (НОВА ПОШТА)</label><input type="text" placeholder="№ відділення або адреса" value={clientAddress} onChange={e => setClientAddress(e.target.value)} className="w-full border-2 border-gray-300 p-2.5 rounded-xl text-sm focus:border-blue-600 focus:outline-none bg-white" /></div>
              <div><label className="block text-xs font-black text-gray-800 mb-1">МЕНЕДЖЕР</label><input type="text" placeholder="Ім'я менеджера" value={manager} onChange={e => setManager(e.target.value)} className="w-full border-2 border-gray-300 p-2.5 rounded-xl text-sm focus:border-blue-600 focus:outline-none bg-white" /></div>
              <div><label className="block text-xs font-black text-gray-800 mb-1">КОМЕНТАР</label><textarea placeholder="Коментар..." value={comment} onChange={e => setComment(e.target.value)} rows={3} className="w-full border-2 border-gray-300 p-2.5 rounded-xl text-sm focus:border-blue-600 focus:outline-none bg-white" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCheckout(false)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-2.5 rounded-xl hover:bg-gray-300 text-sm">Назад</button>
              <button onClick={sendOrder} className="flex-1 bg-emerald-700 text-white font-black py-2.5 rounded-xl hover:bg-emerald-800 text-sm shadow-md">Надіслати</button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl text-black my-auto border border-gray-200">
            <h2 className="text-xl sm:text-2xl font-black mb-4 border-b pb-2">Попередній перегляд</h2>
            <div className="overflow-x-auto max-h-[50vh] pr-1">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300 font-black"><th className="p-2">Фото</th><th className="p-2">Модель</th><th className="p-2">Колір</th><th className="p-2 text-center">Кіл</th><th className="p-2 text-right">Сума грн</th><th className="p-2"></th></tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.id} className="border-b last:border-0 font-medium">
                      <td className="p-2">
                        {item.image
                          ? <img src={item.image} loading="lazy" className="w-12 h-12 object-contain bg-gray-50 border border-gray-300 rounded-md cursor-pointer" onClick={() => setSelectedImage(item.image)} alt="" />
                          : <div className="w-12 h-12 bg-gray-100 border border-gray-300 rounded-md"></div>
                        }
                      </td>
                      <td className="p-2">
                        <div className="font-bold">{item.name}</div>
                        <div className="text-[10px] text-blue-600 font-bold">{item.category}</div>
                        <div className="text-[10px] text-gray-500">{item.sizes}</div>
                      </td>
                      <td className="p-2 text-xs text-gray-600">
                        {item.frameColor || '—'}<br />
                        <span className="text-gray-400">{item.lensColor}</span>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-300 inline-flex">
                          <button onClick={() => decreaseQty(item.id)} className="w-5 h-5 bg-white hover:bg-gray-200 rounded text-xs font-black flex items-center justify-center border border-gray-300">-</button>
                          <span className="text-xs font-black w-5 text-center">{item.quantity}</span>
                          <button onClick={() => { if (item.quantity < item.stock) increaseQty(item.id) }} className="w-5 h-5 bg-white hover:bg-gray-200 rounded text-xs font-black flex items-center justify-center border border-gray-300">+</button>
                        </div>
                      </td>
                      <td className="p-2 text-right text-emerald-800 font-black">{item.price > 0 ? `${(item.price * currentRate * MARKUP * item.quantity).toFixed(2)} грн` : '—'}</td>
                      <td className="p-2 text-center"><button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 font-black text-lg">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-3 border-t-2 border-gray-300 flex justify-between font-black text-sm sm:text-base">
              <span>Разом: {totalItems} поз.</span>
              <span className="text-emerald-800">{totalPriceUSD.toFixed(2)}$ <span className="text-xs text-gray-600">({totalPriceUAH.toFixed(2)} грн)</span></span>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPreview(false)} className="flex-1 bg-gray-900 text-white font-bold py-2.5 rounded-xl hover:bg-black text-sm">Закрити</button>
              <button onClick={() => { setShowPreview(false); setShowCheckout(true) }} className="flex-1 bg-emerald-700 text-white font-black py-2.5 rounded-xl hover:bg-emerald-800 text-sm shadow-md">Оформити</button>
            </div>
          </div>
        </div>
      )}

      {showHistory && role === 'admin' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl p-5 sm:p-6 shadow-2xl text-black my-auto border border-gray-200">
            <div className="flex justify-between items-center border-b-2 pb-3 mb-4">
              <h2 className="text-xl sm:text-2xl font-black">📋 Історія замовлень</h2>
              <div className="flex gap-2">
                {orderHistory.length > 0 && (
                  <button onClick={() => { if (confirm('Очистити всю історію?')) setOrderHistory([]) }} className="text-red-500 hover:text-red-700 text-xs font-bold px-3 py-1.5 border border-red-300 rounded-lg">Очистити</button>
                )}
                <button onClick={() => setShowHistory(false)} className="bg-gray-200 font-bold px-3 py-1.5 rounded-lg text-sm hover:bg-gray-300">Закрити</button>
              </div>
            </div>
            {orderHistory.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Замовлень ще не було</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {orderHistory.map(order => (
                  <div key={order.id} className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <div className="font-black text-gray-950">{order.clientName}</div>
                        <div className="text-xs text-gray-500">{order.clientPhone} · {order.clientCity} · {order.clientStore}</div>
                        {order.manager && <div className="text-xs text-gray-500">Менеджер: {order.manager}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-black text-emerald-700">{order.totalUSD}$</div>
                        <div className="text-xs text-gray-500">{order.totalUAH} грн</div>
                        <div className="text-[10px] text-gray-400 mt-1">{order.date}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      {order.items.map((item, i) => (
                        <div key={i} className="text-xs text-gray-600 flex justify-between py-0.5">
                          <span>{item.brand} {item.name}</span>
                          <span className="font-bold">{item.qty} шт · {item.price > 0 ? `${item.price}$` : 'ціну уточнюйте'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
