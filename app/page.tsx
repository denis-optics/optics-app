'use client'

import { useEffect, useState } from 'react'
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

export default function Page() {
  const SITE_PASSWORD = 'optics2026'

  // TELEGRAM
  const TELEGRAM_BOT_TOKEN = 'PASTE_YOUR_BOT_TOKEN'
  const TELEGRAM_CHAT_ID = 'PASTE_YOUR_CHAT_ID'

  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const [selectedBrand, setSelectedBrand] = useState('INVU')
  const [search, setSearch] = useState('')

  // MODALS
  const [showPreview, setShowPreview] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)

  // CLIENT DATA
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientStore, setClientStore] = useState('')
  const [manager, setManager] = useState('')

  useEffect(() => {
    fetch(
      'https://opensheet.elk.sh/1gdR4vklSLgR1z_LmdN7IzOxzgxvEUc4DTdWq0KQReQc/Sheet1'
    )
      .then((res) => res.json())
      .then((data) => {
        const formatted: Product[] = data.map(
          (item: any, index: number) => ({
            id: index,

            name: item['Название'] || 'Без назви',

            price: Number(
              String(item['Цена'] || '0').replace(',', '.')
            ),

            stock: Number(item['Остаток'] || 0),

            description: item['Описание'] || '',

            image:
              item['image'] || '/images/no-image.jpg',

            brand: item['Торговая марка'] || '',

            promo: String(item['Акция'] || '')
              .toLowerCase()
              .includes('ак'),

            sizes: item['Размеры'] || '',
          })
        )

        setProducts(formatted)
      })
  }, [])

  const brands = [
    'INVU',
    'STYLE MARK',
    'PERSONA',
    'INVU FRAME',
    'INVU CLIP-ON',
    'STYLE MARK CLIP-ON',
  ]

  const increaseQty = (id: number) => {
    const product = products.find((p) => p.id === id)

    if (!product) return

    setQuantities((prev) => {
      const current = prev[id] || 1

      if (current >= product.stock) {
        return prev
      }

      return {
        ...prev,
        [id]: current + 1,
      }
    })
  }

  const decreaseQty = (id: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max((prev[id] || 1) - 1, 1),
    }))
  }

  const toggleCart = (product: Product) => {
    const qty = Math.min(
      quantities[product.id] || 1,
      product.stock
    )

    if (cart.find((p) => p.id === product.id)) {
      setCart(
        cart.filter((p) => p.id !== product.id)
      )
    } else {
      setCart([
        ...cart,
        {
          ...product,
          quantity: qty,
        },
      ])
    }
  }

  const totalItems = cart.reduce(
    (sum, p) => sum + p.quantity,
    0
  )

  const totalUsd = cart.reduce(
    (sum, p) => sum + p.price * p.quantity,
    0
  )

  const totalUah = cart.reduce(
    (sum, p) =>
      sum +
      p.price *
        44.2 *
        1.02 *
        p.quantity,
    0
  )

  const exportToExcel = () => {
    const wsData: any[][] = []

    wsData.push(['ФИО клиента', clientName])
    wsData.push([
      'Контактная информация',
      `${clientPhone}, ${clientCity}`,
    ])
    wsData.push([
      'Адрес доставки',
      clientAddress,
    ])
    wsData.push([
      'Название магазина',
      clientStore,
    ])
    wsData.push(['Менеджер', manager])
    wsData.push([
      'Дата заказа',
      new Date().toLocaleString(),
    ])

    wsData.push([])

    wsData.push([
      'Название коллекции',
      'Артикул',
      'Количество',
      'Цена за шт грн',
      'Сумма грн',
      'Сумма $',
    ])

    cart.forEach((p) => {
      wsData.push([
        p.brand,
        p.name,
        p.quantity,
        (
          p.price *
          44.2 *
          1.02
        ).toFixed(2),

        (
          p.price *
          44.2 *
          1.02 *
          p.quantity
        ).toFixed(2),

        (
          p.price *
          p.quantity
        ).toFixed(2),
      ])
    })

    wsData.push([])

    wsData.push([
      'ИТОГО',
      '',
      totalItems,
      '',
      totalUah.toFixed(2),
      totalUsd.toFixed(2),
    ])

    const worksheet =
      XLSX.utils.aoa_to_sheet(wsData)

    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 28 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ]

    const workbook =
      XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Замовлення'
    )

    const excelBuffer = XLSX.write(
      workbook,
      {
        bookType: 'xlsx',
        type: 'array',
      }
    )

    const fileData = new Blob(
      [excelBuffer],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    )

    saveAs(
      fileData,
      `zamovlennya_${clientName || 'client'}.xlsx`
    )
  }

  const sendTelegramOrder = async () => {
    try {
      const orderText = `
НОВЕ ЗАМОВЛЕННЯ

👤 Клієнт: ${clientName}

📞 Телефон: ${clientPhone}

🏙 Місто: ${clientCity}

📦 Адреса: ${clientAddress}

🏪 Магазин: ${clientStore}

👨 Менеджер: ${manager}

----------------------------

${cart
  .map(
    (p) =>
      `${p.brand}
${p.name}
Кількість: ${p.quantity}
Сума: ${(p.price * p.quantity).toFixed(2)} $
`
  )
  .join('\n')}

----------------------------

Всього штук: ${totalItems}

Сума USD: ${totalUsd.toFixed(2)} $

Сума грн: ${totalUah.toFixed(2)} грн
`

      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: orderText,
          }),
        }
      )

      if (response.ok) {
        alert('Замовлення відправлено')

        exportToExcel()

        setCart([])
        setShowOrderModal(false)
      } else {
        alert('Помилка Telegram')
      }
    } catch (error) {
      alert('Помилка відправки')
    }
  }

  if (!authorized) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/images/login-bg.jpg')",
        }}
      >
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-80">
          <h1 className="text-3xl font-bold mb-6 text-center text-black">
            Вхід
          </h1>

          <input
            type="password"
            placeholder="Введіть пароль"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="border w-full p-3 rounded-xl mb-4 text-black"
          />

          <button
            onClick={() => {
              if (
                password === SITE_PASSWORD
              ) {
                setAuthorized(true)
              } else {
                alert('Невірний пароль')
              }
            }}
            className="w-full bg-blue-600 text-white py-3 rounded-xl"
          >
            Увійти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen text-black">
      {/* FILTERS */}
      <div className="sticky top-0 z-40 bg-white p-4 rounded-2xl shadow mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Пошук товару..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="border p-2 rounded-lg w-full"
          />

          <select
            value={selectedBrand}
            onChange={(e) =>
              setSelectedBrand(
                e.target.value
              )
            }
            className="border p-2 rounded-lg"
          >
            {brands.map((b) => (
              <option
                key={b}
                value={b}
              >
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* PRODUCTS */}
        <div className="col-span-3 grid grid-cols-3 gap-4">
          {products
            .filter((p) => {
              const matchesBrand =
                selectedBrand === p.brand

              const matchesSearch =
                p.name
                  .toLowerCase()
                  .includes(
                    search.toLowerCase()
                  ) ||
                p.brand
                  .toLowerCase()
                  .includes(
                    search.toLowerCase()
                  )

              const hasStock = search
                ? true
                : p.stock > 0

              return (
                matchesBrand &&
                matchesSearch &&
                hasStock
              )
            })

            .map((p) => (
              <div
                key={p.id}
                className="border rounded-2xl p-4 shadow bg-white relative"
              >
                {p.promo && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                    АКЦІЯ
                  </div>
                )}

                <div className="h-[180px] flex items-center justify-center bg-gray-100 rounded-xl p-2">
                  <img
                    src={p.image}
                    alt={p.name}
                    onClick={() =>
                      setSelectedImage(
                        p.image
                      )
                    }
                    className="max-w-full max-h-full object-contain cursor-pointer"
                  />
                </div>

                <h2 className="text-lg font-bold mt-2">
                  {p.name}
                </h2>

                <p className="text-sm text-gray-500">
                  {p.brand}
                </p>

                <p className="text-sm">
                  {p.description}
                </p>

                <p className="text-sm text-gray-600">
                  Розміри: {p.sizes}
                </p>

                <p className="font-semibold mt-2">
                  {p.price} $

                  <span className="text-green-700 ml-2">
                    (
                    {(
                      p.price *
                      44.2 *
                      1.02
                    ).toFixed(2)}{' '}
                    грн)
                  </span>
                </p>

                <p className="text-sm mt-1">
                  Залишок:{' '}
                  {p.stock > 5
                    ? 'більше 5'
                    : p.stock}
                </p>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() =>
                      decreaseQty(p.id)
                    }
                    className="w-8 h-8 bg-gray-300 rounded"
                  >
                    −
                  </button>

                  <span className="w-6 text-center font-semibold">
                    {quantities[p.id] ||
                      1}
                  </span>

                  <button
                    onClick={() =>
                      increaseQty(p.id)
                    }
                    className="w-8 h-8 bg-gray-300 rounded"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() =>
                    toggleCart(p)
                  }
                  className="mt-3 bg-blue-600 text-white px-3 py-2 rounded-xl w-full"
                >
                  {cart.find(
                    (c) => c.id === p.id
                  )
                    ? 'Прибрати'
                    : 'Обрати'}
                </button>
              </div>
            ))}
        </div>

        {/* CART */}
        <div className="border rounded-2xl p-4 shadow sticky top-24 bg-white h-[85vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">
            Замовлення
          </h2>

          {cart.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between mb-2 text-sm border-b pb-2"
            >
              <div>
                <div>{p.name}</div>

                <div className="text-xs text-gray-500">
                  {p.quantity} шт
                </div>
              </div>

              <div>
                {(
                  p.price *
                  44.2 *
                  1.02 *
                  p.quantity
                ).toFixed(2)}{' '}
                грн
              </div>
            </div>
          ))}

          <div className="mt-4 border-t pt-4">
            <div className="flex justify-between">
              <span>Всього:</span>

              <span>
                {totalItems}
              </span>
            </div>

            <div className="flex justify-between font-bold mt-2">
              <span>Сума:</span>

              <span>
                {totalUah.toFixed(2)} грн
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <button
              onClick={() =>
                setShowPreview(true)
              }
              className="w-full bg-gray-800 text-white py-3 rounded-xl"
            >
              Попередній перегляд
            </button>

            <button
              onClick={() =>
                setShowOrderModal(true)
              }
              className="w-full bg-green-600 text-white py-3 rounded-xl"
            >
              Зробити замовлення
            </button>
          </div>
        </div>
      </div>

      {/* IMAGE MODAL */}
      {selectedImage && (
        <div
          onClick={() =>
            setSelectedImage(null)
          }
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        >
          <img
            src={selectedImage}
            alt=""
            className="max-w-[90%] max-h-[90%] object-contain"
          />
        </div>
      )}

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                Попередній перегляд
              </h2>

              <button
                onClick={() =>
                  setShowPreview(false)
                }
                className="bg-red-500 text-white px-4 py-2 rounded-xl"
              >
                Закрити
              </button>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2">
                    Колекція
                  </th>

                  <th className="border p-2">
                    Артикул
                  </th>

                  <th className="border p-2">
                    Фото
                  </th>

                  <th className="border p-2">
                    Акція
                  </th>

                  <th className="border p-2">
                    Ціна
                  </th>

                  <th className="border p-2">
                    Сума
                  </th>
                </tr>
              </thead>

              <tbody>
                {cart.map((p) => (
                  <tr key={p.id}>
                    <td className="border p-2">
                      {p.brand}
                    </td>

                    <td className="border p-2">
                      {p.name}
                    </td>

                    <td className="border p-2">
                      <img
                        src={p.image}
                        alt=""
                        className="w-16 h-16 object-contain mx-auto"
                      />
                    </td>

                    <td className="border p-2 text-center">
                      {p.promo
                        ? 'АКЦІЯ'
                        : ''}
                    </td>

                    <td className="border p-2">
                      {p.price.toFixed(2)} $
                      <br />
                      (
                      {(
                        p.price *
                        44.2 *
                        1.02
                      ).toFixed(2)}{' '}
                      грн)
                    </td>

                    <td className="border p-2">
                      {(
                        p.price *
                        p.quantity
                      ).toFixed(2)}{' '}
                      $
                      <br />
                      (
                      {(
                        p.price *
                        44.2 *
                        1.02 *
                        p.quantity
                      ).toFixed(2)}{' '}
                      грн)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ORDER MODAL */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl">
            <h2 className="text-2xl font-bold mb-6">
              Дані замовлення
            </h2>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="ПІБ / ФОП"
                value={clientName}
                onChange={(e) =>
                  setClientName(
                    e.target.value
                  )
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Телефон"
                value={clientPhone}
                onChange={(e) =>
                  setClientPhone(
                    e.target.value
                  )
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Місто"
                value={clientCity}
                onChange={(e) =>
                  setClientCity(
                    e.target.value
                  )
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Адреса доставки"
                value={clientAddress}
                onChange={(e) =>
                  setClientAddress(
                    e.target.value
                  )
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Назва магазину"
                value={clientStore}
                onChange={(e) =>
                  setClientStore(
                    e.target.value
                  )
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Менеджер"
                value={manager}
                onChange={(e) =>
                  setManager(
                    e.target.value
                  )
                }
                className="w-full border p-3 rounded-xl"
              />
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() =>
                  setShowOrderModal(
                    false
                  )
                }
                className="w-full bg-gray-400 text-white py-3 rounded-xl"
              >
                Скасувати
              </button>

              <button
                onClick={
                  sendTelegramOrder
                }
                className="w-full bg-green-600 text-white py-3 rounded-xl"
              >
                Відправити замовлення
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}