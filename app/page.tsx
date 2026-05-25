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

const SITE_PASSWORD = 'optics2026'
// Единый курс: 44.2 + 2% наценки
const EXCHANGE_RATE = 44.2 * 1.02 

const BRANDS = [
  'INVU',
  'STYLE MARK',
  'PERSONA',
  'INVU FRAME',
  'INVU CLIP-ON',
  'STYLE MARK CLIP-ON'
]

// Доступные фоны для экрана входа
const BACKGROUND_PRESETS = [
  { id: 'optics-bg-1', name: 'Стильні окуляри', url: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=1200&q=80' },
  { id: 'optics-bg-2', name: 'Світлий інтер\'єр', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&q=80' },
  { id: 'optics-bg-3', name: 'Мінімалізм', url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&q=80' }
]

export default function Page() {
  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')
  const [bgImage, setBgImage] = useState(BACKGROUND_PRESETS[0].url)

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const [selectedBrand, setSelectedBrand] = useState('INVU')
  const [search, setSearch] = useState('')

  const [showCheckout, setShowCheckout] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientStore, setClientStore] = useState('')
  const [manager, setManager] = useState('')

  // Загрузка данных
  useEffect(() => {
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
          sizes: item['Размеры'] || ''
        }))
        setProducts(formatted)
      })
      .catch((err) => console.error("Помилка завантаження даних:", err))
  }, [])

  // Изменение количества с синхронизацией в корзине
  const updateQuantity = (id: number, newQty: number) => {
    const product = products.find((p) => p.id === id)
    if (!product) return

    // Валидация границ остатка
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

  // Функция для красивого отображения остатка (Пункт 5)
  const renderStockStatus = (stock: number) => {
    if (stock > 5) {
      return <span className="text-green-600 font-medium">більше 5</span>
    }
    return <span className="text-orange-600 font-bold">{stock} шт</span>
  }

  // Оптимизированные подсчеты через useMemo
  const { totalItems, totalPriceUAH, totalPriceUSD } = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        acc.totalItems += item.quantity
        acc.totalPriceUSD += item.price * item.quantity
        acc.totalPriceUAH += item.price * EXCHANGE_RATE * item.quantity
        return acc
      },
      { totalItems: 0, totalPriceUAH: 0, totalPriceUSD: 0 }
    )
  }, [cart])

  // Фильтрация продуктов
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesBrand = selectedBrand === p.brand
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase())
      return matchesBrand && matchesSearch && p.stock > 0
    })
  }, [products, selectedBrand, search])

  const exportToExcel = () => {
    const rows: any[] = []

    rows.push(['ПІБ клієнта', clientName])
    rows.push(['Контактна інформація', clientPhone])
    rows.push(['Адреса доставки', clientAddress])
    rows.push(['Назва магазину', clientStore])
    rows.push(['Дата замовлення', new Date().toLocaleDateString()])
    rows.push([])

    rows.push(['Колекція', 'Артикул', 'Кількість', 'Ціна грн', 'Сума грн', 'Сума $'])

    cart.forEach((p) => {
      rows.push([
        p.brand,
        p.name,
        p.quantity,
        (p.price * EXCHANGE_RATE).toFixed(2),
        (p.price * EXCHANGE_RATE * p.quantity).toFixed(2),
        (p.price * p.quantity).toFixed(2)
      ])
    })

    rows.push([])
    rows.push(['Разом', '', totalItems, '', totalPriceUAH.toFixed(2), totalPriceUSD.toFixed(2)])

    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Замовлення')

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    saveAs(fileData, `zamovlennya_${clientName || 'client'}.xlsx`)
  }

  const sendOrder = async () => {
    if (!clientName || !clientPhone) {
      alert('Будь ласка, заповніть обов\'язкові поля (ПІБ та Телефон)')
      return
    }

    try {
      const productsText = cart.map((p) =>
        `${p.brand} | ${p.name} | ${p.quantity} шт`
      ).join('\n')

      const res = await fetch('/api/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientPhone,
          clientCity,
          clientAddress,
          clientStore,
          manager,
          total: totalPriceUAH.toFixed(2),
          products: productsText,
        }),
      })

      if (!res.ok) throw new Error()

      exportToExcel()
      alert('Замовлення успешно відправлено')
      
      setCart([])
      setQuantities({})
      setClientName('')
      setClientPhone('')
      setClientCity('')
      setClientAddress('')
      setClientStore('')
      setShowCheckout(false)
    } catch (err) {
      alert('Помилка відправлення')
    }
  }

  if (!authorized) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center bg-cover bg-center transition-all duration-500 p-4"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
        {/* Контрастное белоснежное окно входа с четким черным текстом */}
        <div className="bg-white/95 p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-gray-200 text-black backdrop-blur-sm">
          <h1 className="text-3xl font-black mb-2 text-center text-gray-900 tracking-tight">ВХІД</h1>
          <p className="text-sm text-center text-gray-600 mb-6 font-medium">Оптика оптова платформа</p>
          
          <input
            type="password"
            placeholder="Введіть пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && password === SITE_PASSWORD && setAuthorized(true)}
            className="border-2 border-gray-300 w-full p-3.5 rounded-xl mb-4 text-center text-lg font-bold text-black focus:border-blue-600 focus:outline-none transition"
            autoFocus
          />
          <button
            onClick={() => {
              if (password === SITE_PASSWORD) {
                setAuthorized(true)
              } else {
                alert('Невірний пароль')
              }
            }}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition shadow-lg shadow-blue-600/30 text-base"
          >
            Увійти
          </button>

          {/* Панель выбора фонового рисунка */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">Оберіть фон екрану:</p>
            <div className="grid grid-cols-3 gap-2">
              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setBgImage(preset.url)}
                  className={`text-[10px] p-2 font-semibold rounded-lg border transition truncate ${
                    bgImage === preset.url 
                      ? 'bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-600/20' 
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen text-black">
      {/* Фильтры */}
      <div className="sticky top-0 z-40 bg-white p-4 rounded-2xl shadow mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Пошук товару..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border p-2 rounded-lg w-full"
          />
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="border p-2 rounded-lg"
          >
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Сетка товаров */}
        <div className="col-span-3 grid grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isInCart = cart.some((c) => c.id === p.id);
            const currentQty = quantities[p.id] || 1;
            return (
              <div key={p.id} className="border rounded-2xl p-4 shadow bg-white relative flex flex-col justify-between">
                {p.promo && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded z-10">
                    АКЦІЯ
                  </div>
                )}

                <div>
                  <div className="h-[180px] flex items-center justify-center bg-gray-100 rounded-xl overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.name}
                      onClick={() => setSelectedImage(p.image)}
                      className="max-h-full object-contain cursor-pointer hover:scale-105 transition"
                    />
                  </div>

                  <h2 className="font-bold mt-3 line-clamp-2">{p.name}</h2>
                  <p className="text-sm text-gray-500">{p.brand}</p>
                </div>

                <div className="mt-4">
                  <p className="text-gray-600">{p.price} $</p>
                  <p className="text-green-700 font-semibold">
                    {(p.price * EXCHANGE_RATE).toFixed(2)} грн
                  </p>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => decreaseQty(p.id)}
                      className="w-8 h-8 bg-gray-300 rounded font-bold hover:bg-gray-400 active:scale-95 transition"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={currentQty}
                      onChange={(e) => updateQuantity(p.id, parseInt(e.target.value) || 1)}
                      className="w-12 text-center font-semibold bg-transparent border-b border-gray-300 focus:outline-none"
                    />
                    <button
                      onClick={() => increaseQty(p.id)}
                      className="w-8 h-8 bg-gray-300 rounded font-bold hover:bg-gray-400 active:scale-95 transition"
                    >
                      +
                    </button>
                    {/* Строка остатка из пункта 5 */}
                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                      В наявності: {renderStockStatus(p.stock)}
                    </span>
                  </div>

                  <button
                    onClick={() => toggleCart(p)}
                    className={`mt-3 px-3 py-2 rounded-xl w-full text-white font-semibold transition ${
                      isInCart ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isInCart ? 'Прибрати' : 'Обрати'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Боковая корзина (Пункты 1, 2, 3, 4) */}
        <div className="border rounded-2xl shadow bg-white sticky top-24 h-[85vh] flex flex-col justify-between overflow-hidden">
          {/* Шапка корзины */}
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold">Замовлення</h2>
          </div>

          {/* Скроллящийся блок со списком товаров + миниатюры (Пункт 1, 2) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <p className="text-gray-400 text-center mt-8">Корзина порожня</p>
            ) : (
              cart.map((p) => (
                <div key={p.id} className="flex gap-3 items-center border-b pb-3 last:border-0">
                  {/* Маленькая картинка товара */}
                  <img 
                    src={p.image} 
                    className="w-10 h-10 object-contain bg-gray-50 border rounded-lg flex-shrink-0 cursor-pointer" 
                    alt="" 
                    onClick={() => setSelectedImage(p.image)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm line-clamp-1 text-gray-900">{p.name}</div>
                    <div className="text-xs text-green-700 font-medium mt-0.5">
                      {(p.price * EXCHANGE_RATE * p.quantity).toFixed(2)} грн
                    </div>
                    
                    {/* Регулировка количества прямо в корзине (Пункт 4) */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button 
                        onClick={() => decreaseQty(p.id)}
                        className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold w-6 text-center">{p.quantity}</span>
                      <button 
                        onClick={() => increaseQty(p.id)}
                        className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold flex items-center justify-center"
                      >
                        +
                      </button>
                      <span className="text-[10px] text-gray-400 ml-auto">макс: {p.stock}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Жестко зафиксированный подвал с суммами и кнопками (Пункт 3) */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-between text-sm font-medium text-gray-600">
              <span>Всього позицій:</span>
              <span className="text-gray-900 font-bold">{totalItems}</span>
            </div>
            <div className="flex justify-between font-black text-lg mt-1 border-b pb-3">
              <span>Сума:</span>
              <span className="text-green-700">{totalPriceUAH.toFixed(2)} грн</span>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => setShowPreview(true)}
              className="w-full mt-3 bg-gray-800 text-white py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 hover:bg-gray-900 transition"
            >
              Переглянути замовлення
            </button>

            <button
              disabled={cart.length === 0}
              onClick={() => setShowCheckout(true)}
              className="w-full mt-2 bg-green-600 text-white py-3 rounded-xl disabled:opacity-50 font-bold text-base hover:bg-green-700 transition shadow-md shadow-green-600/20"
            >
              Зробити замовлення
            </button>
          </div>
        </div>
      </div>

      {/* Модалка: Превью таблицы (Пункт 4 - Изменение количества) */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl p-6 overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Попередній перегляд замовлення</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl font-bold transition"
              >
                Закрити
              </button>
            </div>
            
            <div className="overflow-auto flex-1 border rounded-xl">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-100 sticky top-0 shadow-sm z-10 text-gray-700 font-bold">
                    <th className="p-3 border">Колекція</th>
                    <th className="p-3 border">Артикул</th>
                    <th className="p-3 border">Фото</th>
                    <th className="p-3 border">Кількість</th>
                    <th className="p-3 border">Ціна</th>
                    <th className="p-3 border">Сума</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cart.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="p-3 border text-sm">{p.brand}</td>
                      <td className="p-3 border font-semibold text-gray-900">{p.name}</td>
                      <td className="p-3 border">
                        <img src={p.image} className="w-12 h-12 object-contain bg-gray-50 border rounded" alt="" />
                      </td>
                      {/* Управление количеством внутри предварительного просмотра */}
                      <td className="p-3 border">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => decreaseQty(p.id)}
                            className="w-7 h-7 bg-gray-200 hover:bg-gray-300 active:scale-95 text-sm font-bold rounded flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-bold text-base w-8 text-center">{p.quantity}</span>
                          <button 
                            onClick={() => increaseQty(p.id)}
                            className="w-7 h-7 bg-gray-200 hover:bg-gray-300 active:scale-95 text-sm font-bold rounded flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 text-center">доступно: {p.stock}</div>
                      </td>
                      <td className="p-3 border text-sm">
                        <span className="font-medium">{p.price}$</span> <br />
                        <span className="text-gray-500">({(p.price * EXCHANGE_RATE).toFixed(2)} грн)</span>
                      </td>
                      <td className="p-3 border text-sm font-bold">
                        <span className="text-gray-900">{(p.price * p.quantity).toFixed(2)}$</span> <br />
                        <span className="text-green-700">({(p.price * EXCHANGE_RATE * p.quantity).toFixed(2)} грн)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Итоговая плашка в превью */}
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border flex justify-between items-center">
              <span className="font-bold text-gray-700">Всього позицій у списку: <span className="text-gray-900 text-lg ml-1">{totalItems}</span></span>
              <span className="font-black text-xl text-green-700">Загальна сума: {totalPriceUAH.toFixed(2)} грн</span>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Оформление заказа */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Оформлення замовлення</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="ПІБ / ФОП *"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full border p-3 rounded-xl focus:border-blue-600 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Телефон *"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full border p-3 rounded-xl focus:border-blue-600 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Місто"
                value={clientCity}
                onChange={(e) => setClientCity(e.target.value)}
                className="w-full border p-3 rounded-xl focus:border-blue-600 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Адреса доставки"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="w-full border p-3 rounded-xl focus:border-blue-600 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Назва магазину"
                value={clientStore}
                onChange={(e) => setClientStore(e.target.value)}
                className="w-full border p-3 rounded-xl focus:border-blue-600 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Менеджер"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className="w-full border p-3 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white py-3 rounded-xl font-semibold transition"
              >
                Скасувати
              </button>
              <button
                onClick={sendOrder}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition"
              >
                Відкрити й зберегти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Зум картинки */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-zoom-out animate-fadeIn"
        >
          <img src={selectedImage} className="max-w-[90%] max-h-[90%] object-contain" alt="Zoomed view" />
        </div>
      )}
    </div>
  )
}