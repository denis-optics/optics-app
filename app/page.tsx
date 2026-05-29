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
const DEFAULT_FALLBACK_RATE = 44.20 //базовий курс
const START_BACKGROUND_URL = 'https://static.wixstatic.com/media/65047e_b23681171c07497b889c2c474fb7c9a1~mv2.jpg/v1/fill/w_868,h_825,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/65047e_b23681171c07497b889c2c474fb7c9a1~mv2.jpg'

export default function Page() {
  const [authorized, setAuthorized] = useState(false)
  const [role, setRole] = useState<'admin' | 'guest' | null>(null)
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [search, setSearch] = useState('')
  
  // Курс валют та дата
  const [currentRate, setCurrentRate] = useState<number>(DEFAULT_FALLBACK_RATE)
  const [rateDate, setRateDate] = useState<string>('')
  const [isRateLoading, setIsRateLoading] = useState(true)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  useEffect(() => {
    // 1. Завантаження курсу
    fetch('https://opensheet.elk.sh/1gFtRzDVggVbSuzkZtiCs8KAqDV2u-5oCBWxDltFi_7g/Course')
      .then((res) => {
        if (!res.ok) throw new Error("Не вдалося завантажити сторінку Course")
        return res.json()
      })
      .then((data) => {
        if (data && data.length > 0) {
          const firstRow = data[0]
          const rateValue = firstRow['Курс'] || firstRow['курс'] || firstRow['Rate'] || Object.values(firstRow)[0]
          if (rateValue) {
            const cleanRate = String(rateValue).replace(/\s+/g, '').replace(',', '.')
            const parsedRate = parseFloat(cleanRate)
            if (!isNaN(parsedRate) && parsedRate > 0) {
              setCurrentRate(parsedRate)
            }
          }
          if (data[1]) {
            const possibleDate = Object.values(data[1])[0] || Object.values(data[0])[1];
            if (possibleDate && String(possibleDate).includes('.')) {
              setRateDate(String(possibleDate))
            } else if (data[2]) {
              const alternativeDate = Object.values(data[2])[0];
              setRateDate(String(alternativeDate || ''))
            }
          }
        }
        setIsRateLoading(false)
      })
      .catch((err) => {
        console.error("Помилка завантаження курсу:", err)
        setIsRateLoading(false)
      })

    // 2. Завантаження товарів
    fetch('https://opensheet.elk.sh/1gFtRzDVggVbSuzkZtiCs8KAqDV2u-5oCBWxDltFi_7g/Sheet1')
      .then((res) => res.json())
      .then((data) => {
        const formatted: Product[] = data.map((item: any, index: number) => {
          const rawPrice = String(item['Цена'] || '0').replace(/\s+/g, '').replace(',', '.');
          const parsedPrice = parseFloat(rawPrice);
          return {
            id: index,
            name: item['Название'] || 'Без назви',
            price: isNaN(parsedPrice) || parsedPrice <= 0 ? 0 : parsedPrice,
            stock: Number(item['Остаток'] || 0),
            description: item['Описание'] || '',
            image: item['image'] && item['image'].trim() !== '' ? item['image'] : '',
            brand: item['Торговая марка'] || '',
            promo: String(item['Акция'] || '').toLowerCase().includes('ак'),
            sizes: item['Размеры'] || '—'
          }
        })
        setProducts(formatted)

        if (formatted.length > 0) {
          const firstBrand = formatted.find(p => p.brand)?.brand || ''
          setSelectedBrand(firstBrand)
        }
      })
      .catch((err) => console.error("Помилка завантаження даних товарів:", err))
  }, [])

  const dynamicBrands = useMemo(() => {
    return Array.from(new Set(products.map(p => p.brand))).filter(Boolean)
  }, [products])

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
      return <span className="text-red-600 font-black text-sm">немає</span>
    }
    if (stock > 5) {
      return <span className="text-emerald-700 font-black text-sm">&gt; 5 шт</span>
    }
    return <span className="text-amber-700 font-black text-sm">{stock} шт</span>
  }

  const { totalItems, totalPriceUAH, totalPriceUSD } = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        acc.totalItems += item.quantity
        acc.totalPriceUSD += item.price * item.quantity
        acc.totalPriceUAH += item.price * currentRate * 1.02 * item.quantity
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
    const today = new Date().toLocaleDateString('uk-UA')
    const rows = [
      ['ПІБ клієнта', clientName || '—'],
      ['Контактна інформація', clientPhone || '—'],
      ['Місто', clientCity || '—'],
      ['Адреса доставки', clientAddress || '—'],
      ['Назва магазину', clientStore || '—'],
      ['Менеджер', manager || '—'],
      ['Коментар', comment || '—'],
      ['Дата замовлення', today],
      [], 
      ['Колекція', 'Артикул', 'Розміри', 'Кількість', 'Ціна $', 'Ціна грн', 'Сума $', 'Сума грн']
    ]
    cart.forEach((p) => {
      const hasPrice = p.price > 0
      rows.push([
        p.brand,
        p.name,
        p.sizes,
        String(p.quantity),
        hasPrice ? p.price.toFixed(2) : 'Ціну уточнюйте',
        hasPrice ? (p.price * currentRate * 1.02).toFixed(2) : '—',
        hasPrice ? (p.price * p.quantity).toFixed(2) : '—',
        hasPrice ? (p.price * currentRate * 1.02 * p.quantity).toFixed(2) : '—'
      ])
    })
    rows.push([])
    rows.push(['Разом', '', '', String(totalItems), '', '', totalPriceUSD.toFixed(2), totalPriceUAH.toFixed(2)])
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
    const isConfirmed = confirm('Ви впевнені, що хочете сформувати та надіслати замовлення?')
    if (!isConfirmed) return
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

      saveAs(excelBlob, `zamovlennya_${clientName.replace(/\s+/g, '_')}.xlsx`)
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

  // ВІДНОВЛЕНА ОРИГІНАЛЬНА КОРЗИНА (стилі тексту text-xs, font-bold тощо)
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
              {p.image ? (
                <img
                  src={p.image}
                  className="w-10 h-10 object-contain bg-gray-50 border-2 border-gray-200 rounded-lg flex-shrink-0 cursor-pointer"
                  alt=""
                  onClick={() => setSelectedImage(p.image)}
                />
              ) : (
                <div className="w-10 h-10 bg-gray-100 border border-gray-300 rounded-lg flex-shrink-0"></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs line-clamp-1 text-gray-900">{p.name}</div>
                <div className="text-xs text-emerald-800 font-bold mt-0.5">
                  {p.price > 0 ? `${(p.price * p.quantity).toFixed(2)}$` : 'Ціну уточнюйте'} {p.price > 0 && <span className="text-gray-600 font-medium text-[10px]">({(p.price * currentRate * 1.02 * p.quantity).toFixed(2)} грн)</span>}
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

  if (!authorized) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat w-screen h-screen"
        style={{ backgroundImage: `url(${START_BACKGROUND_URL})` }}
      >
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="bg-white/95 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative z-10 border border-white/20">
          <h1 className="text-xl sm:text-2xl font-black text-gray-950 mb-1 tracking-tight">Вхід до каталогу</h1>
          <p className="text-xs text-gray-600 font-bold mb-6">Будь ласка, введіть ваш пароль доступу</p>
          <input
            type="password"
            placeholder="Введіть пароль..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth(password)}
            className="w-full border-2 border-gray-300 p-3 rounded-xl text-center font-black text-gray-900 text-base mb-4 focus:border-blue-600 focus:outline-none bg-white tracking-widest"
          />
          <button
            onClick={() => handleAuth(password)}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3 rounded-xl transition text-sm shadow-md"
          >
            Увійти в каталог
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 bg-gray-100 min-h-screen text-black pb-24 lg:pb-6">
      {/* ВЕРХНЯЯ ПАНЕЛЬ */}
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
              {dynamicBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3 bg-gray-50 p-2.5 rounded-xl border-2 border-gray-200 w-full lg:w-auto">
            <div className="flex flex-col items-start lg:items-end">
              <span className="text-[11px] sm:text-xs font-black text-gray-900 leading-tight">Поточний курс $:</span>
              <span className="text-[10px] text-gray-600 font-black mt-1">
                {isRateLoading ? "Оновлення..." : `Зміна: ${rateDate || 'не вказана'}`}
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
          <p className="text-[11px] text-blue-700 font-bold">  ⚠️  Активовано наскрізний пошук. Показуються всі моделі, включаючи відсутні на складі.</p>
        )}
      </div>

      {/* КАТАЛОГ З ОРИГІНАЛЬНИМИ СТИЛЯМИ КАРТОЧОК */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isInCart = cart.some((c) => c.id === p.id);
            const currentQty = quantities[p.id] || 1;
            const isOutOfStock = p.stock === 0;
            return (
              <div
                key={p.id}
                className={`border-2 border-gray-300 rounded-2xl p-4 shadow-md relative flex flex-col justify-between transition-all duration-200 hover:border-gray-400 ${
                  isOutOfStock ? 'opacity-60 bg-gray-200' : 'bg-gray-100'
                }`}
              >
                {p.promo && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded z-10">
                    % АКЦІЯ
                  </div>
                )}

                <div>
                  <div className="h-[175px] flex items-center justify-center bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        onClick={() => setSelectedImage(p.image)}
                        className={`max-h-full object-contain cursor-pointer hover:scale-105 transition duration-200 ${
                          isOutOfStock ? 'grayscale' : ''
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full bg-white rounded-xl"></div>
                    )}
                  </div>

                  {/* ОРИГІНАЛЬНІ ШРИФТИ ТА ВІДСТУПИ */}
                  <div className="mt-3.5 space-y-1.5">
                    <h2 className="font-black line-clamp-1 text-sm sm:text-base text-gray-950 tracking-tight">{p.name}</h2>
                    <div className="flex flex-col gap-1 text-xs sm:text-sm font-bold">
                      <span className="text-gray-700">Бренд: <span className="text-gray-950 font-black text-sm sm:text-base">{p.brand}</span></span>
                      <span className="font-mono text-gray-700">Розмір: <span className="text-gray-950 font-black bg-white px-2 py-0.5 rounded border border-gray-300 text-xs inline-block mt-0.5">{p.sizes}</span></span>
                    </div>
                    <div className="pt-1 flex items-center justify-between text-xs sm:text-sm font-bold">
                      <span className="text-gray-700">Статус:</span>
                      {renderStockStatus(p.stock)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Ціна:</span>
                    <div className="text-right">
                      <div className="text-emerald-800 font-black text-base sm:text-lg leading-tight">
                        {p.price > 0 ? `${(p.price * currentRate * 1.02).toFixed(2)} грн` : <span className="text-amber-700 text-sm">ціну уточнюйте</span>}
                      </div>
                      {p.price > 0 && (
                        <div className="text-[11px] font-bold text-blue-950/70 mt-0.5">
                          {p.price.toFixed(2)} $
                        </div>
                      )}
                    </div>
                  </div>

                  {!isOutOfStock && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-gray-200/70 p-1 rounded-xl border border-gray-300">
                        <button
                          onClick={() => decreaseQty(p.id)}
                          className="w-8 h-8 bg-white hover:bg-gray-100 active:scale-95 text-gray-900 font-black text-lg rounded-lg transition shadow-sm flex items-center justify-center border border-gray-300"
                        >
                          -
                        </button>
                        <span className="font-black text-sm text-gray-950 w-10 text-center">{currentQty} шт</span>
                        <button
                          onClick={() => increaseQty(p.id)}
                          className="w-8 h-8 bg-white hover:bg-gray-100 active:scale-95 text-gray-900 font-black text-lg rounded-lg transition shadow-sm flex items-center justify-center border border-gray-300"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => toggleCart(p)}
                        className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 shadow-sm ${
                          isInCart
                            ? 'bg-red-600 hover:bg-red-700 text-white border border-red-700'
                            : 'bg-blue-700 hover:bg-blue-800 text-white border border-blue-800'
                        }`}
                      >
                        {isInCart ? 'Прибрати з кошика' : 'Додати в кошик'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ПРАВА ПАНЕЛЬ ДЛЯ ДЕСКТОПІВ */}
        <div className="hidden lg:block col-span-1 bg-white rounded-2xl shadow-md border border-gray-200 relative flex flex-col h-[calc(100vh-140px)] sticky top-[110px] overflow-hidden">
          <CartContent />
        </div>
      </div>

      {/* МОБІЛЬНА КНОПКА КОШИКА */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="w-full bg-slate-900 text-white font-black py-3 px-4 rounded-xl shadow-xl flex justify-between items-center text-sm border border-black hover:bg-black transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2">
            <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-black min-w-[20px] text-center">
              {cart.length}
            </span>
            <span>Переглянути замовлення</span>
          </div>
          <span className="font-mono bg-white/10 px-2 py-1 rounded text-emerald-400">
            {totalPriceUSD.toFixed(2)}$
          </span>
        </button>
      </div>

      {/* МОБІЛЬНИЙ КУРТЕР (Drawer) */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-white">
          <CartContent />
        </div>
      )}

      {/* МОДАЛЬНЕ ВІКНО ПЕРЕГЛЯДУ ЗОБРАЖЕННЯ */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full bg-white p-2 rounded-2xl shadow-2xl">
            <img src={selectedImage} className="max-h-[80vh] object-contain rounded-xl" alt="Preview" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 bg-red-600 text-white font-black rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-red-700 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* МОДАЛЬНЕ ВІКНО ПОПЕРЕДНЬОГО ПЕРЕГЛЯДУ ТАБЛИЦІ */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-4 sm:p-6 my-8 border border-gray-100 flex flex-col max-h-[90vh]">
            <h3 className="text-base sm:text-lg font-black text-gray-950 mb-3 pb-2 border-b border-gray-200 uppercase tracking-wide">
              Попередній перегляд Excel файлу
            </h3>
            <div className="overflow-auto flex-1 border border-gray-300 rounded-xl bg-gray-50 p-2">
              <table className="w-full text-[11px] sm:text-xs text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-200 font-black text-gray-800 border-b border-gray-300">
                    <th className="p-2 border-r border-gray-300">Колекція</th>
                    <th className="p-2 border-r border-gray-300">Артикул</th>
                    <th className="p-2 border-r border-gray-300">Розміри</th>
                    <th className="p-2 text-center border-r border-gray-300">Кількість</th>
                    <th className="p-2 text-right border-r border-gray-300">Ціна $</th>
                    <th className="p-2 text-right border-r border-gray-300">Ціна грн</th>
                    <th className="p-2 text-right border-r border-gray-300">Сума $</th>
                    <th className="p-2 text-right">Сума грн</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {cart.map((item) => {
                    const hasPrice = item.price > 0
                    const itemTotalUSD = item.price * item.quantity
                    const itemTotalUAH = item.price * currentRate * 1.02 * item.quantity
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 text-gray-900 font-bold">
                        <td className="p-2 border-r border-gray-200">{item.brand}</td>
                        <td className="p-2 border-r border-gray-200 font-mono text-[10px] sm:text-xs">{item.name}</td>
                        <td className="p-2 border-r border-gray-200">{item.sizes}</td>
                        <td className="p-2 text-center border-r border-gray-200 font-black">{item.quantity}</td>
                        <td className="p-2 text-right border-r border-gray-200 font-mono text-gray-600">
                          {hasPrice ? `${item.price.toFixed(2)} $` : <span className="text-amber-700 text-[11px] font-black">ціну уточнюйте</span>}
                        </td>
                        <td className="p-2 text-right border-r border-gray-200 font-mono text-gray-600">
                          {hasPrice ? `${(item.price * currentRate * 1.02).toFixed(2)} грн` : <span className="text-amber-700 text-[11px] font-black">—</span>}
                        </td>
                        <td className="p-2 text-right border-r border-gray-200 font-black text-blue-950 text-sm">
                          {hasPrice ? `(${item.price.toFixed(2)} $)` : <span className="text-amber-700 text-[11px] font-black">ціну уточнюйте</span>}
                        </td>
                        <td className="p-2 text-right text-emerald-800 font-black">
                          {hasPrice ? `${itemTotalUAH.toFixed(2)} грн` : <span className="text-amber-700 text-[11px] font-black">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-3 border-t-2 border-gray-300 flex justify-between items-center font-black text-sm sm:text-base">
              <span>Разом позицій: {totalItems}</span>
              <span className="text-emerald-800 text-right">
                {totalPriceUSD.toFixed(2)}$ <span className="text-xs text-gray-600">({totalPriceUAH.toFixed(2)} грн)</span>
              </span>
            </div>
            <div className="mt-5">
              <button
                onClick={() => setShowPreview(false)}
                className="w-full bg-gray-900 text-white font-bold py-2.5 rounded-xl hover:bg-black transition text-xs sm:text-sm"
              >
                Закрити перегляд
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ОФОРМЛЕННЯ ЗАМОВЛЕННЯ */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 my-8 border border-gray-100">
            <h3 className="text-base sm:text-lg font-black text-gray-950 mb-1 uppercase tracking-wide">
              Оформлення замовлення
            </h3>
            <p className="text-[11px] text-gray-500 font-bold mb-4">Будь ласка, заповніть дані для формування накладної</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">ПІБ Клієнта *</label>
                <input
                  type="text"
                  placeholder="Іванов Іван Іванович"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2 rounded-xl font-medium text-sm text-gray-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Телефон *</label>
                <input
                  type="text"
                  placeholder="+380..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2 rounded-xl font-medium text-sm text-gray-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Місто</label>
                <input
                  type="text"
                  placeholder="Київ"
                  value={clientCity}
                  onChange={(e) => setClientCity(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2 rounded-xl font-medium text-sm text-gray-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Адреса доставки</label>
                <input
                  type="text"
                  placeholder="Нова Пошта №..."
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2 rounded-xl font-medium text-sm text-gray-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Назва магазину</label>
                <input
                  type="text"
                  placeholder="Оптика..."
                  value={clientStore}
                  onChange={(e) => setClientStore(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2 rounded-xl font-medium text-sm text-gray-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Менеджер</label>
                <input
                  type="text"
                  placeholder="Ім'я менеджера"
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2 rounded-xl font-medium text-sm text-gray-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Коментар до замовлення</label>
                <textarea
                  rows={2}
                  placeholder="Ваш коментар..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full border-2 border-gray-300 p-2 rounded-xl font-medium text-sm text-gray-900 focus:border-emerald-600 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={sendOrder}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl transition text-sm uppercase tracking-wider shadow-md"
              >
                Підтвердити та надіслати
              </button>
              <button
                onClick={() => setShowCheckout(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded-xl transition text-xs"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}