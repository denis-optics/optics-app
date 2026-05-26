'use client'

import { useEffect, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

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
}

type CartItem = Product & {
  quantity: number
}

const ADMIN_PASSWORD = 'admin2026'
const GUEST_PASSWORD = 'optics2026'
const DEFAULT_FALLBACK_RATE = 44.20 // Чистый базовый курс на случай сбоя сети

const BRANDS = [
  'INVU',
  'STYLE MARK',
  'PERSONA',
  'INVU FRAME',
  'INVU CLIP-ON',
  'STYLE MARK CLIP-ON'
]

const START_BACKGROUND_URL = 'https://static.wixstatic.com/media/65047e_b23681171c07497b889c2c474fb7c9a1~mv2.jpg/v1/fill/w_868,h_825,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/65047e_b23681171c07497b889c2c474fb7c9a1~mv2.jpg'

export default function Page() {
  const [authorized, setAuthorized] = useState(false)
  const [role, setRole] = useState<'admin' | 'guest' | null>(null)
  const [password, setPassword] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const [selectedBrand, setSelectedBrand] = useState('INVU')
  const [search, setSearch] = useState('')
  
  // Состояние курса валют
  const [currentRate, setCurrentRate] = useState<number>(DEFAULT_FALLBACK_RATE)
  const [isRateLoading, setIsRateLoading] = useState(true)
  
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  useEffect(() => {
    // 1. Загрузка курса из вкладки "Course"
    fetch('https://opensheet.elk.sh/1gdR4vklSLgR1z_LmdN7IzOxzgxvEUc4DTdWq0KQReQc/Course')
      .then((res) => {
        if (!res.ok) throw new Error("Не вдалося завантажити сторінку Course")
        return res.json()
      })
      .then((data) => {
        console.log("Дані курсу з таблиці:", data)
        
        if (data && data.length > 0) {
          const firstRow = data[0]
          const rateValue = firstRow['Курс'] || firstRow['курс'] || firstRow['Rate'] || Object.values(firstRow)[0]
          
          if (rateValue) {
            const cleanRate = String(rateValue).replace(/\s+/g, '').replace(',', '.')
            const parsedRate = parseFloat(cleanRate)
            
            if (!isNaN(parsedRate) && parsedRate > 0) {
              setCurrentRate(parsedRate)
            } else {
              console.error("Курс в таблиці не є числом:", rateValue)
            }
          } else {
            console.error("Не знайдено колонку 'Курс' в комірці A1.")
          }
        } else {
          console.error("Вкладка 'Course' порожня.")
        }
        setIsRateLoading(false)
      })
      .catch((err) => {
        console.error("Помилка завантаження курсу з таблиці:", err)
        setIsRateLoading(false)
      })

    // 2. Загрузка товаров из вкладки "Sheet1"
    fetch('https://opensheet.elk.sh/1gdR4vklSLgR1z_LmdN7IzOxzgxvEUc4DTdWq0KQReQc/Sheet1')
      .then((res) => res.json())
      .then((data) => {
        const formatted: Product[] = data.map((item: any, index: number) => ({
          id: index,
          name: item['Название'] || 'Без назви',
          price: Number(String(item['Цена'] || '0').replace(',', '.')),
          stock: Number(item['Остаток'] || 0),
          description: item['Описание'] || '',
          image: item['image'] || '/images/no-image.jpg',
          brand: item['Торговая марка'] || '',
          promo: String(item['Акция'] || '').toLowerCase().includes('ак'),
          sizes: item['Размеры'] || '—'
        }))
        setProducts(formatted)
      })
      .catch((err) => console.error("Помилка завантаження даних товарів:", err))
  }, [])

  const [showCheckout, setShowCheckout] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientStore, setClientStore] = useState('')
  const [manager, setManager] = useState('')
  const [comment, setComment] = useState('')

  const updateQuantity = (id: number, newQty: number) => {
    const product = products.find((p) => p.id === id)
    if (!product) return

    const targetQty = Math.max(1, Math.min(newQty, product.stock))
    setQuantities((prev) => ({ ...prev, [id]: targetQty }))
    
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id ? { ...item, quantity: targetQty } : item
      )
    )
  }

  const increaseQty = (id: number) => {
    const currentQty = quantities[id] || 1
    updateQuantity(id, currentQty + 1)
  }

  const decreaseQty = (id: number) => {
    const currentQty = quantities[id] || 1
    updateQuantity(id, currentQty - 1)
  }

  const toggleCart = (product: Product) => {
    const qty = quantities[product.id] || 1

    if (cart.find((p) => p.id === product.id)) {
      setCart(cart.filter((p) => p.id !== product.id))
    } else {
      setCart([...cart, { ...product, quantity: qty }])
    }
  }

  const renderStockStatus = (stock: number) => {
    if (stock === 0) {
      return <span className="text-red-600 font-bold text-xs">немає</span>
    }
    if (stock > 5) {
      return <span className="text-emerald-700 font-bold text-xs">&gt; 5 шт</span>
    }
    return <span className="text-amber-700 font-bold text-xs">{stock} шт</span>
  }

  const { totalItems, totalPriceUAH, totalPriceUSD } = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        acc.totalItems += item.quantity
        acc.totalPriceUSD += item.price * item.quantity
        acc.totalPriceUAH += item.price * currentRate * item.quantity
        return acc
      },
      { totalItems: 0, totalPriceUAH: 0, totalPriceUSD: 0 }
    )
  }, [cart, currentRate])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase()) ||
        p.sizes.toLowerCase().includes(search.toLowerCase())

      if (search.trim() !== '') {
        return matchesSearch
      }
      
      return selectedBrand === p.brand && p.stock > 0
    })
  }, [products, selectedBrand, search])

  const generateExcelBlob = () => {
    const rows: any[] = []
    rows.push(['ПІБ клієнта', clientName])
    rows.push(['Контактна інформація', clientPhone])
    rows.push(['Місто', clientCity])
    rows.push(['Адреса доставки', clientAddress])
    rows.push(['Назва магазину', clientStore])
    rows.push(['Менеджер', manager])
    rows.push(['Коментар', comment])
    rows.push(['Дата замовлення', new Date().toLocaleDateString()])
    rows.push([])
    rows.push(['Колекція', 'Артикул', 'Розміри', 'Кількість', 'Ціна $', 'Ціна грн', 'Сума $', 'Сума грн'])

    cart.forEach((p) => {
      rows.push([
        p.brand,
        p.name,
        p.sizes,
        p.quantity,
        p.price.toFixed(2),
        (p.price * currentRate).toFixed(2),
        (p.price * p.quantity).toFixed(2),
        (p.price * currentRate * p.quantity).toFixed(2)
      ])
    })

    rows.push([])
    rows.push(['Разом', '', '', totalItems, '', '', totalPriceUSD.toFixed(2), totalPriceUAH.toFixed(2)])

    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Замовлення')
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  const handleAuth = (inputPass: string) => {
    if (inputPass === ADMIN_PASSWORD) {
      setRole('admin')
      setAuthorized(true)
    } else if (inputPass === GUEST_PASSWORD) {
      setRole('guest')
      setAuthorized(true)
    } else {
      alert('Невірний пароль')
    }
  }

  const sendOrder = async () => {
    if (!clientName || !clientPhone) {
      alert('Будь ласка, заповніть обов\'язкові поля (ПІБ та Телефон)')
      return
    }

    try {
      const excelBlob = generateExcelBlob()
      const formData = new FormData()
      
      formData.append('clientName', clientName)
      formData.append('clientPhone', clientPhone)
      formData.append('clientCity', clientCity)
      formData.append('clientAddress', clientAddress)
      formData.append('clientStore', clientStore)
      formData.append('manager', manager)
      formData.append('comment', comment)
      formData.append('totalUSD', totalPriceUSD.toFixed(2))
      formData.append('totalUAH', totalPriceUAH.toFixed(2))
      formData.append('excelFile', excelBlob, `Order_${clientName.replace(/\s+/g, '_')}.xlsx`)

      const res = await fetch('/api/send-order', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error()

      saveAs(excelBlob, `zamovlennya_${clientName || 'client'}.xlsx`)
      alert('Замовлення успішно відправлено на пошту та у Telegram!')
      
      setCart([])
      setQuantities({})
      setClientName('')
      setClientPhone('')
      setClientCity('')
      setClientAddress('')
      setClientStore('')
      setComment('')
      setShowCheckout(false)
      setIsMobileCartOpen(false)
    } catch (err) {
      alert('Помилка відправлення через API')
    }
  }

  if (!authorized) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center bg-cover bg-center p-4 relative"
        style={{ backgroundImage: `url(${START_BACKGROUND_URL})` }}
      >
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        <div className="bg-white/95 p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-gray-200 text-black backdrop-blur-md relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-center text-gray-900 tracking-tight">ВХІД</h1>
          <p className="text-xs sm:text-sm text-center text-gray-700 mb-6 font-semibold">Оптика оптова платформа</p>
          
          <input
            type="password"
            placeholder="Введіть пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth(password)}
            className="border-2 border-gray-400 w-full p-3 rounded-xl mb-4 text-center text-base sm:text-lg font-bold text-black focus:border-blue-700 focus:outline-none transition bg-white"
            autoFocus
          />
          <button
            onClick={() => handleAuth(password)}
            className="w-full bg-blue-700 text-white font-bold py-3 rounded-xl hover:bg-blue-800 active:scale-[0.98] transition shadow-lg shadow-blue-700/30 text-sm sm:text-base"
          >
            Увійти
          </button>
        </div>
      </div>
    )
  }

  const CartContent = () => (
    <>
      <div className="p-4 border-b flex justify-between items-center bg-white">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Замовлення</h2>
        <button 
          onClick={() => setIsMobileCartOpen(false)} 
          className="lg:hidden text-gray-700 font-bold text-sm px-2.5 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Згорнути
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        {cart.length === 0 ? (
          <p className="text-gray-500 text-center mt-8 text-sm font-medium">Кошик порожній</p>
        ) : (
          cart.map((p) => (
            <div key={p.id} className="flex gap-3 items-center border-b pb-3 last:border-0">
              <img 
                src={p.image} 
                className="w-10 h-10 object-contain bg-gray-50 border-2 border-gray-200 rounded-lg flex-shrink-0 cursor-pointer" 
                alt="" 
                onClick={() => setSelectedImage(p.image)}
              />
              
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs line-clamp-1 text-gray-900">{p.name}</div>
                <div className="text-xs text-emerald-800 font-bold mt-0.5">
                  {(p.price * p.quantity).toFixed(2)}$ <span className="text-gray-600 font-medium text-[10px]">({(p.price * currentRate * p.quantity).toFixed(2)} грн)</span>
                </div>
                
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button 
                    onClick={() => decreaseQty(p.id)}
                    className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-black text-gray-900 flex items-center justify-center border border-gray-300"
                  >
                    -
                  </button>
                  <span className="text-xs font-black text-gray-950 w-6 text-center">{p.quantity}</span>
                  <button 
                    onClick={() => increaseQty(p.id)}
                    className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-black text-gray-900 flex items-center justify-center border border-gray-300"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t bg-gray-100 sticky bottom-0">
        <div className="flex justify-between text-xs sm:text-sm font-bold text-gray-700">
          <span>Всього позицій:</span>
          <span className="text-gray-950 font-black">{totalItems}</span>
        </div>
        <div className="flex justify-between font-black text-sm sm:text-base mt-2 border-b border-gray-300 pb-3 items-center">
          <span className="text-gray-900">Загальна сума:</span>
          <span className="text-emerald-800 text-right">
            {totalPriceUSD.toFixed(2)}$ <br />
            <span className="text-xs text-gray-600 font-bold">({totalPriceUAH.toFixed(2)} грн)</span>
          </span>
        </div>

        <button
          disabled={cart.length === 0}
          onClick={() => setShowPreview(true)}
          className="w-full mt-3 bg-gray-900 text-white py-2 rounded-xl font-bold text-xs sm:text-sm disabled:opacity-50 hover:bg-black transition border border-black"
        >
          Переглянути замовлення
        </button>

        <button
          disabled={cart.length === 0}
          onClick={() => setShowCheckout(true)}
          className="w-full mt-2 bg-emerald-700 text-white py-2.5 rounded-xl disabled:opacity-50 font-black text-sm sm:text-base hover:bg-emerald-800 transition shadow-md"
        >
          Зробити замовлення
        </button>
      </div>
    </>
  )

  return (
    <div className="p-3 sm:p-6 bg-gray-100 min-h-screen text-black pb-24 lg:pb-6">
      {/* ВЕРХНЯЯ ПАНЕЛЬ С КУРСОМ */}
      <div className="sticky top-0 z-40 bg-white p-3 sm:p-4 rounded-2xl shadow mb-4 sm:mb-6 space-y-3 border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1 w-full">
            <input
              type="text"
              placeholder="Глобальний пошук по всьому каталогу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-2 border-gray-300 p-2 rounded-lg w-full text-sm font-medium text-gray-900 focus:border-blue-600 focus:outline-none"
            />
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="border-2 border-gray-300 p-2 rounded-lg text-sm bg-white font-bold text-gray-900 disabled:opacity-40 w-full sm:w-auto min-w-[180px]"
              disabled={search.trim() !== ''}
            >
              {BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3 bg-gray-50 p-2.5 rounded-xl border-2 border-gray-200 w-full lg:w-auto">
            <div className="flex flex-col items-start lg:items-end">
              <span className="text-[11px] sm:text-xs font-black text-gray-900 leading-tight">Поточний курс $:</span>
              <span className="text-[9px] sm:text-[10px] text-gray-600 font-bold mt-0.5">
                {isRateLoading ? "Оновлення..." : "Синхронізовано з Google"}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="font-black text-blue-800 text-sm sm:text-lg bg-blue-50 px-2.5 py-1 rounded-lg border-2 border-blue-200">
                {currentRate.toFixed(2)} грн
              </span>
            </div>
          </div>
        </div>
        {search.trim() !== '' && (
          <p className="text-[11px] text-blue-700 font-bold">⚠️ Активовано наскрізний пошук. Показуються всі моделі, включаючи відсутні на складі.</p>
        )}
      </div>

      {/* КАТАЛОГ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isInCart = cart.some((c) => c.id === p.id);
            const currentQty = quantities[p.id] || 1;
            const isOutOfStock = p.stock === 0;

            return (
              <div 
                key={p.id} 
                className={`border-2 border-gray-200 rounded-2xl p-3.5 shadow-sm bg-white relative flex flex-col justify-between transition-all duration-200 hover:border-gray-300 ${
                  isOutOfStock ? 'opacity-60 bg-gray-50' : ''
                }`}
              >
                {p.promo && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded z-10">
                    % АКЦІЯ
                  </div>
                )}

                {/* Изображение */}
                <div>
                  <div className="h-[150px] flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.name}
                      onClick={() => setSelectedImage(p.image)}
                      className={`max-h-full object-contain cursor-pointer hover:scale-105 transition duration-200 ${
                        isOutOfStock ? 'grayscale' : ''
                      }`}
                    />
                  </div>

                  {/* Аккуратный текстовый блок повышенной контрастности */}
                  <div className="mt-2.5 space-y-1">
                    <h2 className="font-black line-clamp-1 text-xs sm:text-sm text-gray-950 tracking-tight">{p.name}</h2>
                    
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-gray-700">Бренд: <span className="text-gray-950 font-black">{p.brand}</span></span>
                      <span className="font-mono text-gray-700">Розмір: <span className="text-gray-950 font-bold bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{p.sizes}</span></span>
                    </div>
                  </div>
                </div>

                {/* Блок Цен и Кнопок */}
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-600 text-xs font-bold">{p.price} $</span>
                    <span className="text-emerald-800 font-black text-sm sm:text-base">
                      {(p.price * currentRate).toFixed(2)} грн
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                    <button
                      disabled={isOutOfStock}
                      onClick={() => decreaseQty(p.id)}
                      className="w-7 h-7 bg-white rounded-lg font-black text-gray-900 hover:bg-gray-200 transition disabled:opacity-30 flex items-center justify-center text-sm border border-gray-300"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      disabled={isOutOfStock}
                      value={isOutOfStock ? 0 : currentQty}
                      onChange={(e) => updateQuantity(p.id, parseInt(e.target.value) || 1)}
                      className="w-8 text-center font-black bg-transparent text-xs text-gray-950 focus:outline-none disabled:text-gray-400"
                    />
                    <button
                      disabled={isOutOfStock}
                      onClick={() => increaseQty(p.id)}
                      className="w-7 h-7 bg-white rounded-lg font-black text-gray-900 hover:bg-gray-200 transition disabled:opacity-30 flex items-center justify-center text-sm border border-gray-300"
                    >
                      +
                    </button>
                    <div className="ml-auto pr-1 font-bold text-gray-900">
                      {renderStockStatus(p.stock)}
                    </div>
                  </div>

                  <button
                    disabled={isOutOfStock}
                    onClick={() => toggleCart(p)}
                    className={`mt-2.5 px-3 py-2 rounded-xl w-full text-white font-black transition text-xs sm:text-sm shadow-sm ${
                      isOutOfStock 
                        ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                        : isInCart ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
                    }`}
                  >
                    {isOutOfStock ? 'Немає в наявності' : isInCart ? 'Прибрати з кошика' : 'Обрати модель'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* БОКОВАЯ КОРЗИНА ДЛЯ ПК */}
        <div className="hidden lg:flex border-2 border-gray-200 rounded-2xl shadow bg-white sticky top-24 h-[85vh] flex-col justify-between overflow-hidden">
          <CartContent />
        </div>
      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ КОРЗИНЫ ДЛЯ СМАРТФОНОВ */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl p-3 z-40 flex items-center justify-between gap-4 rounded-t-2xl">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-600">Обрано: <span className="text-gray-950 font-black">{totalItems} шт.</span></span>
            <span className="text-emerald-800 font-black text-sm">{totalPriceUSD.toFixed(2)}$ <span className="text-xs font-bold text-gray-600">({totalPriceUAH.toFixed(2)} грн)</span></span>
          </div>
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="bg-blue-700 text-white font-black px-5 py-2.5 rounded-xl text-xs active:scale-95 transition shadow-md"
          >
            Подивитись кошик
          </button>
        </div>
      )}

      {/* ВЫЕЗЖАЮЩАЯ МОБИЛЬНАЯ КОРЗИНА */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <CartContent />
          </div>
        </div>
      )}

      {/* МОДАЛКА ПРЕДВАРИТЕЛЬНОГО ПРОСМОТРА БЕЗ КОЛОНКИ ЗАЛИШОК */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white w-full max-w-6xl h-[95vh] lg:h-[85vh] rounded-2xl p-4 sm:p-6 overflow-hidden flex flex-col shadow-2xl border border-gray-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-2xl font-black text-gray-950">Попередній перегляд замовлення</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm transition"
              >
                Закрити
              </button>
            </div>
            
            <div className="overflow-auto flex-1 border-2 border-gray-200 rounded-xl bg-white text-xs sm:text-sm">
              <table className="w-full border-collapse text-left min-w-[650px]">
                <thead>
                  <tr className="bg-gray-100 font-black text-gray-900 border-b-2 border-gray-200">
                    <th className="p-2 sm:p-3 border-r">Колекція</th>
                    <th className="p-2 sm:p-3 border-r">Артикул</th>
                    <th className="p-2 sm:p-3 border-r text-center">Фото</th>
                    <th className="p-2 sm:p-3 border-r">Розміри</th>
                    <th className="p-2 sm:p-3 border-r">Кількість</th>
                    <th className="p-2 sm:p-3 border-r">Ціна</th>
                    <th className="p-2 sm:p-3 data-cell">Сума</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cart.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition text-gray-950 font-medium">
                      <td className="p-2 border-r font-bold text-gray-800">{p.brand}</td>
                      <td className="p-2 border-r font-black text-gray-950">{p.name}</td>
                      <td className="p-1 border-r text-center w-20 h-20">
                        <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center mx-auto">
                          <img 
                            src={p.image} 
                            className="max-w-full max-h-full object-contain" 
                            alt="" 
                            onClick={() => setSelectedImage(p.image)}
                          />
                        </div>
                      </td>
                      <td className="p-2 border-r font-mono font-black text-gray-900">{p.sizes}</td>
                      <td className="p-2 border-r">
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => decreaseQty(p.id)}
                            className="w-6 h-6 bg-gray-200 text-xs font-black rounded border border-gray-300 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-black text-gray-950 w-5 text-center">{p.quantity}</span>
                          <button 
                            onClick={() => increaseQty(p.id)}
                            className="w-6 h-6 bg-gray-200 text-xs font-black rounded border border-gray-300 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-2 border-r text-[11px] font-bold">
                        <span className="text-gray-950 font-black">{p.price}$</span> <br />
                        <span className="text-gray-600">({(p.price * currentRate).toFixed(1)} грн)</span>
                      </td>
                      <td className="p-2 text-[11px] font-black">
                        <span className="text-blue-800">{(p.price * p.quantity).toFixed(2)}$</span> <br />
                        <span className="text-emerald-800">({(p.price * currentRate * p.quantity).toFixed(1)} грн)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-gray-100 rounded-xl border-2 border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs sm:text-sm">
              <span className="font-black text-gray-800">Всього позицій у списку: <span className="text-gray-950 font-black">{totalItems}</span></span>
              <span className="font-black text-sm sm:text-lg text-emerald-800">
                Загальна сума: {totalPriceUSD.toFixed(2)}$ <span className="text-xs font-black text-gray-600">({totalPriceUAH.toFixed(2)} грн)</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА ОФОРМЛЕНИЯ ЗАКАЗА */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white p-5 sm:p-8 rounded-2xl w-full max-w-[550px] max-h-[95vh] overflow-y-auto shadow-2xl text-sm border border-gray-200">
            <h2 className="text-xl sm:text-2xl font-black mb-4 text-gray-950">Оформлення замовлення</h2>
            
            <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl font-black text-blue-950 flex justify-between text-xs sm:text-sm">
              <span>Сума до сплати:</span>
              <span>{totalPriceUSD.toFixed(2)}$ ({totalPriceUAH.toFixed(2)} грн)</span>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="ПІБ / ФОП *"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full border-2 border-gray-300 p-2.5 sm:p-3 rounded-xl font-medium text-gray-950 focus:border-blue-600 focus:outline-none bg-white"
              />
              <input
                type="text"
                placeholder="Телефон *"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full border-2 border-gray-300 p-2.5 sm:p-3 rounded-xl font-medium text-gray-955 focus:border-blue-600 focus:outline-none bg-white"
              />
              <input
                type="text"
                placeholder="Місто"
                value={clientCity}
                onChange={(e) => setClientCity(e.target.value)}
                className="w-full border-2 border-gray-300 p-2.5 sm:p-3 rounded-xl font-medium text-gray-950 focus:border-blue-600 focus:outline-none bg-white"
              />
              <input
                type="text"
                placeholder="Адреса доставки"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="w-full border-2 border-gray-300 p-2.5 sm:p-3 rounded-xl font-medium text-gray-950 focus:border-blue-600 focus:outline-none bg-white"
              />
              <input
                type="text"
                placeholder="Назва магазину"
                value={clientStore}
                onChange={(e) => setClientStore(e.target.value)}
                className="w-full border-2 border-gray-300 p-2.5 sm:p-3 rounded-xl font-medium text-gray-950 focus:border-blue-600 focus:outline-none bg-white"
              />
              <input
                type="text"
                placeholder="Менеджер"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className="w-full border-2 border-gray-300 p-2.5 sm:p-3 rounded-xl font-medium text-gray-950 focus:border-blue-600 focus:outline-none bg-white"
              />
              <textarea
                placeholder="Ваші коментарі до замовлення..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full border-2 border-gray-300 p-2.5 sm:p-3 rounded-xl font-medium text-gray-950 focus:border-blue-600 focus:outline-none font-sans text-xs sm:text-sm bg-white"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2.5 sm:py-3 rounded-xl font-bold transition text-xs sm:text-sm shadow-sm"
              >
                Скасувати
              </button>
              <button
                onClick={sendOrder}
                className="flex-1 bg-emerald-700 text-white py-2.5 sm:py-3 rounded-xl font-black hover:bg-emerald-800 transition shadow-lg text-xs sm:text-sm"
              >
                Відправити замовлення
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-zoom-out"
        >
          <img src={selectedImage} className="max-w-[95%] max-h-[95%] object-contain" alt="Zoomed view" />
        </div>
      )}
    </div>
  )
}