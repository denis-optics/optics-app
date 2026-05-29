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
const START_BACKGROUND_URL = 'https://static.wixstatic.com/media/65047e_b23681171c07497b889c2c474fb7c9a1~mv2.jpg/v1/fill/w_868,h_825,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/65047e_b23681171c07497b889c2c474fb7c9a1~mv2.jpg'

export default function Page() {
  // Инициализация состояний из sessionStorage для предотвращения сброса при обновлении страницы
  const [authorized, setAuthorized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('auth_catalog') === 'true'
    }
    return false
  })
  
  const [role, setRole] = useState<'admin' | 'guest' | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('role_catalog') as 'admin' | 'guest' | null
    }
    return null
  })

  const [password, setPassword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const savedCart = sessionStorage.getItem('cart_catalog')
      return savedCart ? JSON.parse(savedCart) : []
    }
    return []
  })

  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [search, setSearch] = useState('')
  
  // Состояние курса валют и даты изменения
  const [currentRate, setCurrentRate] = useState<number>(DEFAULT_FALLBACK_RATE)
  const [rateDate, setRateDate] = useState<string>('')
  const [isRateLoading, setIsRateLoading] = useState(true)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  // Синхронизация корзины с sessionStorage при её изменении
  useEffect(() => {
    sessionStorage.setItem('cart_catalog', JSON.stringify(cart))
  }, [cart])

  // Скролл к началу страницы при изменении фильтров (выбор бренда или ввод текста)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedBrand, search])

  useEffect(() => {
    // 1. Загрузка курса и даты изменения из вкладки "Course"
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

    // 2. Загрузка товаров из вкладки "Sheet1"
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

        // Автоматически выбираем первую торговую марку из таблицы в качестве активного фильтра
        if (formatted.length > 0) {
          const firstBrand = formatted.find(p => p.brand)?.brand || ''
          setSelectedBrand(firstBrand)
        }
      })
      .catch((err) => console.error("Помилка завантаження даних товарів:", err))
  }, [])

  // Динамический список уникальных брендов прямо из Google Sheets
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

  const removeFromCart = (id: number) => {
    setCart(cart.filter((item) => item.id !== id))
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

  // Правильная генерация полноценного Excel файла (.xlsx), исключающая ошибки формата
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
      [], // Пустая строка-разделитель
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
      sessionStorage.setItem('auth_catalog', 'true')
      sessionStorage.setItem('role_catalog', 'admin')
    } else if (inputPass === GUEST_PASSWORD) {
      setRole('guest')
      setAuthorized(true)
      sessionStorage.setItem('auth_catalog', 'true')
      sessionStorage.setItem('role_catalog', 'guest')
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

      // Скачивание файла клиенту
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
            <div key={p.id} className="flex gap-3 items-center border-b pb-3 last:border-0 relative group">
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
              <div className="flex-1 min-w-0 pr-6">
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
              {/* Кнопка удаления товара из корзины в боковой панели */}
              <button
                onClick={() => removeFromCart(p.id)}
                className="absolute right-0 top-1 text-gray-400 hover:text-red-600 text-lg font-bold p-1 transition duration-150"
                title="Видалити"
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>
      <div className="p-4 border-t bg-gray-100 sticky bottom-0">
        <div className="flex justify-between text-xs sm:text-sm font-bold text-gray-700">
          <span>Всього штук:</span>
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

  // СТАРТОВОЕ ОКНО ВХОДА С ПАРОЛЕМ (БЕЗ РАЗМЫТИЯ, НА ВСЮ ВЫСОТУ И ШИРИНУ)
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

                  <div className="mt-3.5 space-y-1.5">
                    <h2 className="font-black line-clamp-1 text-sm sm:text-base text-gray-950 tracking-tight">{p.name}</h2>
                    <div className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">Бренд: {p.brand}</div>
                    <p className="text-xs font-medium text-gray-700 line-clamp-2 min-h-[32px] leading-relaxed">{p.description || "Опис відсутній"}</p>
                    <div className="text-xs text-gray-900 font-bold bg-white px-2.5 py-1 rounded-lg border border-gray-200 inline-block">
                      Розміри: <span className="font-mono text-blue-800">{p.sizes}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200/80 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-gray-500">Наявність:</span>
                    {renderStockStatus(p.stock)}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500">Ціна:</span>
                    <div className="text-right">
                      {p.price > 0 ? (
                        <>
                          <div className="text-lg font-black text-blue-950 tracking-tight">{(p.price).toFixed(2)} $</div>
                          <div className="text-xs font-black text-emerald-800">{(p.price * currentRate * 1.02).toFixed(2)} грн</div>
                        </>
                      ) : (
                        <div className="text-xs font-black text-amber-700 uppercase tracking-tighter bg-amber-50 px-2 py-0.5 rounded border border-amber-200">ціну уточнюйте</div>
                      )}
                    </div>
                  </div>

                  {!isOutOfStock && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-gray-300 shadow-xs">
                        <button
                          onClick={() => {
                            const current = quantities[p.id] || 1
                            if (current > 1) updateQuantity(p.id, current - 1)
                          }}
                          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-black text-gray-900 flex items-center justify-center border border-gray-200"
                        >
                          -
                        </button>
                        <span className="text-sm font-black text-gray-950 w-8 text-center">{currentQty}</span>
                        <button
                          onClick={() => {
                            const current = quantities[p.id] || 1
                            if (current < p.stock) updateQuantity(p.id, current + 1)
                          }}
                          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-black text-gray-900 flex items-center justify-center border border-gray-200"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => toggleCart(p)}
                        className={`w-full py-2.5 rounded-xl font-black text-xs sm:text-sm transition shadow-sm border ${
                          isInCart
                            ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700'
                            : 'bg-blue-700 hover:bg-blue-800 text-white border-blue-800'
                        }`}
                      >
                        {isInCart ? 'У замовленні ✓' : 'Додати в замовлення'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* БОКОВАЯ КОРЗИНА ДЛЯ ДЕКСТОПА */}
        <div className="hidden lg:block col-span-1 bg-white rounded-2xl shadow border border-gray-200 h-fit sticky top-[90px] max-h-[calc(100vh-120px)] flex flex-col overflow-hidden">
          <CartContent />
        </div>
      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ КОРЗИНЫ ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 p-3 flex justify-between items-center z-40 shadow-xl">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-gray-500">Всього у кошику:</span>
          <span className="text-sm font-black text-gray-950">{totalItems} шт. ({totalPriceUAH.toFixed(2)} грн)</span>
        </div>
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="bg-blue-700 hover:bg-blue-800 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow border border-blue-800"
        >
          Відкрити замовлення
        </button>
      </div>

      {/* МОДАЛЬНОЕ ОКНО КОРЗИНЫ НА МОБИЛЬНЫХ */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <CartContent />
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО ДЛЯ УВЕЛИЧЕНИЯ ИЗОБРАЖЕНИЙ */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center bg-white rounded-3xl p-3 sm:p-4 shadow-2xl border border-white/10 cursor-default" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} className="max-w-full max-h-[80vh] object-contain rounded-2xl" alt="Збільшене фото" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-gray-900/80 hover:bg-black text-white rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-sm font-black transition shadow"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* ОКНО ПРЕДВАРИТЕЛЬНОГО ПРОСМОТРА */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-3xl p-5 sm:p-6 shadow-2xl text-black relative my-auto border border-gray-200">
            <h2 className="text-xl sm:text-2xl font-black mb-4 text-gray-950 border-b pb-2">Попередній перегляд замовлення</h2>
            
            <div className="overflow-x-auto max-h-[50vh] space-y-2 pr-1">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300 font-black">
                    <th className="p-2">Фото</th>
                    <th className="p-2">Модель (Артикул)</th>
                    <th className="p-2 text-center">Кіл-ть</th>
                    <th className="p-2 text-right">Ціна $</th>
                    <th className="p-2 text-right">Сума грн</th>
                    <th className="p-2 text-center text-red-600">Видалити</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const hasPrice = item.price > 0;
                    const itemTotalUAH = item.price * currentRate * item.quantity * 1.02;
                    const placeholderImg = "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&auto=format&fit=crop&q=60";

                    return (
                      <tr key={item.id} className="border-b last:border-0 font-medium items-center">
                        {/* Фото / Заглушка с возможностью увеличения */}
                        <td className="p-2 w-16 h-16 flex-shrink-0">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              className="w-12 h-12 object-contain bg-gray-50 border border-gray-300 rounded-md cursor-pointer hover:opacity-80 active:scale-95 transition duration-150" 
                              alt="Збільшити" 
                              onClick={() => setSelectedImage(item.image)}
                            />
                          ) : (
                            <div 
                              className="w-12 h-12 border border-gray-300 bg-gray-50 rounded-md flex flex-col items-center justify-center text-center relative overflow-hidden group cursor-pointer"
                              onClick={() => setSelectedImage(placeholderImg)}
                            >
                              <img 
                                src={placeholderImg} 
                                className="w-full h-full object-cover absolute inset-0 opacity-30 group-hover:scale-105 transition duration-200" 
                                alt="" 
                              />
                              <span className="relative z-10 text-[7px] font-black text-gray-900 bg-white/80 px-0.5 rounded shadow-xs uppercase tracking-tighter leading-none text-center select-none">
                                ще малюємо<br/>фото
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Артикул */}
                        <td className="p-2">
                          <div className="font-bold text-gray-950">{item.name}</div>
                          <div className="text-[10px] text-gray-500 font-mono">Бренд: {item.brand} | Розмір: {item.sizes}</div>
                        </td>

                        {/* Изменение количества */}
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-300 inline-flex">
                            <button
                              onClick={() => decreaseQty(item.id)}
                              className="w-5 h-5 bg-white hover:bg-gray-200 rounded text-xs font-black text-gray-900 flex items-center justify-center border border-gray-300"
                            >
                              -
                            </button>
                            <span className="text-xs font-black text-gray-950 w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => {
                                if (item.quantity < item.stock) increaseQty(item.id);
                              }}
                              className="w-5 h-5 bg-white hover:bg-gray-200 rounded text-xs font-black text-gray-900 flex items-center justify-center border border-gray-300"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Цена */}
                        <td className="p-2 text-right font-black text-blue-950 text-sm">
                          {hasPrice ? `(${item.price.toFixed(2)} $)` : <span className="text-amber-700 text-[11px] font-black">ціну уточнюйте</span>}
                        </td>

                        {/* Сумма */}
                        <td className="p-2 text-right text-emerald-800 font-black">
                          {hasPrice ? `${itemTotalUAH.toFixed(2)} грн` : <span className="text-amber-700 text-[11px] font-black">—</span>}
                        </td>

                        {/* Кнопка удаления товара в окне превью */}
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 font-bold text-lg px-2 py-1 transition duration-150"
                            title="Видалити"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Итоговая строка */}
            <div className="mt-4 pt-3 border-t-2 border-gray-300 flex justify-between items-center font-black text-sm sm:text-base">
              <span>Разом штук: {totalItems}</span>
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

      {/* ОКНО ОФОРМЛЕНИЯ ЗАКАЗА */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl text-black relative my-auto border border-gray-200">
            <h2 className="text-lg sm:text-xl font-black mb-1 text-gray-950">Оформлення замовлення</h2>
            <p className="text-[11px] text-gray-500 font-bold mb-4">Будь ласка, заповніть дані для доставки</p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">ПІБ клієнта <span className="text-red-600">*</span></label>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Иван Иванов" className="w-full border-2 border-gray-300 p-2 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:outline-none bg-white text-gray-900" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Телефон <span className="text-red-600">*</span></label>
                <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+380" className="w-full border-2 border-gray-300 p-2 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:outline-none bg-white text-gray-900" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Місто</label>
                <input type="text" value={clientCity} onChange={(e) => setClientCity(e.target.value)} className="w-full border-2 border-gray-300 p-2 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:outline-none bg-white text-gray-900" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Адреса доставки (Нова Пошта)</label>
                <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="№ відділення або поштомату" className="w-full border-2 border-gray-300 p-2 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:outline-none bg-white text-gray-900" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Назва магазину</label>
                <input type="text" value={clientStore} onChange={(e) => setClientStore(e.target.value)} className="w-full border-2 border-gray-300 p-2 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:outline-none bg-white text-gray-900" />
              </div>

              {role === 'admin' && (
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1">Менеджер (Тільки адмін)</label>
                  <input type="text" value={manager} onChange={(e) => setManager(e.target.value)} className="w-full border-2 border-gray-300 p-2 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:outline-none bg-white text-gray-900" />
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Коментар до замовлення</label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full border-2 border-gray-300 p-2 rounded-xl text-xs sm:text-sm font-medium focus:border-blue-600 focus:outline-none bg-white text-gray-900 resize-none"></textarea>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t font-black text-xs sm:text-sm text-right text-emerald-800 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
              До сплати: {totalPriceUSD.toFixed(2)}$ ({totalPriceUAH.toFixed(2)} грн)
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={() => setShowCheckout(false)} className="bg-gray-200 text-gray-800 font-bold py-2.5 rounded-xl hover:bg-gray-300 transition text-xs sm:text-sm border border-gray-300">Назад до кошика</button>
              <button onClick={sendOrder} className="bg-emerald-700 text-white font-black py-2.5 rounded-xl hover:bg-emerald-800 transition text-xs sm:text-sm shadow">Надіслати замовлення</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}