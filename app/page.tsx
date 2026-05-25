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

export default function Page() {
  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')

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
      .catch((err) => console.error("Ошибка загрузки данных:", err))
  }, [])

  // Изменение количества с синхронизацией в корзине
  const updateQuantity = (id: number, newQty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: newQty }))
    
    // Если товар уже в корзине, обновляем количество и там
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id ? { ...item, quantity: newQty } : item
      )
    )
  }

  const increaseQty = (id: number) => {
    const product = products.find((p) => p.id === id)
    if (!product) return
    const currentQty = quantities[id] || 1
    if (currentQty < product.stock) {
      updateQuantity(id, currentQty + 1)
    }
  }

  const decreaseQty = (id: number) => {
    const currentQty = quantities[id] || 1
    if (currentQty > 1) {
      updateQuantity(id, currentQty - 1)
    }
  }

  const toggleCart = (product: Product) => {
    const qty = quantities[product.id] || 1

    if (cart.find((p) => p.id === product.id)) {
      setCart(cart.filter((p) => p.id !== product.id))
    } else {
      setCart([...cart, { ...product, quantity: qty }])
    }
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
      alert('Замовлення успішно відправлено')
      
      // Очистка состояния после успешного заказа
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-2xl shadow w-80">
          <h1 className="text-3xl font-bold mb-6 text-center">Вхід</h1>
          <input
            type="password"
            placeholder="Введіть пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && password === SITE_PASSWORD && setAuthorized(true)}
            className="border w-full p-3 rounded-xl mb-4 text-black"
          />
          <button
            onClick={() => {
              if (password === SITE_PASSWORD) {
                setAuthorized(true)
              } else {
                alert('Невірний пароль')
              }
            }}
            className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition"
          >
            Увійти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen text-black">
      {/* Фильтры */}
      <div className="sticky top-0 z-50 bg-white p-4 rounded-2xl shadow mb-6">
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
                      className="w-8 h-8 bg-gray-300 rounded font-bold"
                    >
                      −
                    </button>
                    <span className="w-8 text-center">
                      {quantities[p.id] || 1}
                    </span>
                    <button
                      onClick={() => increaseQty(p.id)}
                      className="w-8 h-8 bg-gray-300 rounded font-bold"
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-400 ml-auto">Доступно: {p.stock}</span>
                  </div>

                  <button
                    onClick={() => toggleCart(p)}
                    className={`mt-3 px-3 py-2 rounded-xl w-full text-white transition ${
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

        {/* Боковая корзина */}
        <div className="border rounded-2xl p-4 shadow bg-white sticky top-24 h-[85vh] overflow-y-auto flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold mb-4">Замовлення</h2>
            {cart.length === 0 ? (
              <p className="text-gray-400 text-center mt-8">Корзина порожня</p>
            ) : (
              <div className="space-y-2">
                {cart.map((p) => (
                  <div key={p.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <div className="font-semibold text-sm line-clamp-1">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.quantity} шт × {(p.price * EXCHANGE_RATE).toFixed(2)} грн</div>
                    </div>
                    <div className="text-sm font-medium">
                      {(p.price * EXCHANGE_RATE * p.quantity).toFixed(2)} грн
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 border-t pt-4 bg-white">
            <div className="flex justify-between text-sm">
              <span>Всього позицій:</span>
              <span>{totalItems}</span>
            </div>
            <div className="flex justify-between font-bold text-lg mt-2">
              <span>Сума:</span>
              <span className="text-green-700">{totalPriceUAH.toFixed(2)} грн</span>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => setShowPreview(true)}
              className="w-full mt-4 bg-gray-800 text-white py-3 rounded-xl disabled:opacity-50"
            >
              Переглянути замовлення
            </button>

            <button
              disabled={cart.length === 0}
              onClick={() => setShowCheckout(true)}
              className="w-full mt-3 bg-green-600 text-white py-3 rounded-xl disabled:opacity-50 font-semibold"
            >
              Зробити замовлення
            </button>
          </div>
        </div>
      </div>

      {/* Модалка: Превью таблицы */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl p-6 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Попередній перегляд</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="bg-red-500 text-white px-4 py-2 rounded-xl"
              >
                Закрити
              </button>
            </div>
            <div className="overflow-auto flex-1 border rounded-lg">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-200 sticky top-0 shadow-sm">
                    <th className="p-3 border">Колекція</th>
                    <th className="p-3 border">Артикул</th>
                    <th className="p-3 border">Фото</th>
                    <th className="p-3 border">Акція</th>
                    <th className="p-3 border">Ціна</th>
                    <th className="p-3 border">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3 border">{p.brand}</td>
                      <td className="p-3 border font-semibold">{p.name}</td>
                      <td className="p-3 border">
                        <img src={p.image} className="w-12 h-12 object-contain" alt="" />
                      </td>
                      <td className="p-3 border text-red-600 font-bold">{p.promo ? 'АКЦІЯ' : ''}</td>
                      <td className="p-3 border text-sm">
                        {p.price}$ <br />
                        <span className="text-gray-500">({(p.price * EXCHANGE_RATE).toFixed(2)} грн)</span>
                      </td>
                      <td className="p-3 border text-sm font-semibold">
                        {(p.price * p.quantity).toFixed(2)}$ <br />
                        <span className="text-green-700">({(p.price * EXCHANGE_RATE * p.quantity).toFixed(2)} грн)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Оформление заказа */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl w-[500px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Оформлення замовлення</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="ПІБ / ФОП *"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full border p-3 rounded-xl"
              />
              <input
                type="text"
                placeholder="Телефон *"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full border p-3 rounded-xl"
              />
              <input
                type="text"
                placeholder="Місто"
                value={clientCity}
                onChange={(e) => setClientCity(e.target.value)}
                className="w-full border p-3 rounded-xl"
              />
              <input
                type="text"
                placeholder="Адреса доставки"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="w-full border p-3 rounded-xl"
              />
              <input
                type="text"
                placeholder="Назва магазину"
                value={clientStore}
                onChange={(e) => setClientStore(e.target.value)}
                className="w-full border p-3 rounded-xl"
              />
              <input
                type="text"
                placeholder="Менеджер"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className="w-full border p-3 rounded-xl"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 bg-gray-400 text-white py-3 rounded-xl"
              >
                Скасувати
              </button>
              <button
                onClick={sendOrder}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
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
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-zoom-out"
        >
          <img src={selectedImage} className="max-w-[90%] max-h-[90%] object-contain" alt="Zoomed view" />
        </div>
      )}
    </div>
  )
}