'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import emailjs from '@emailjs/browser'

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

export default function Page() {

  const SITE_PASSWORD = 'optics2026'

  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('INVU')

  const [showPreview, setShowPreview] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientStore, setClientStore] = useState('')
  const [manager, setManager] = useState('')
  const BOT_TOKEN = '8902109006:AAFc8yDh3qUME30aUtIXHqSbgj1XJjKcq0w'
const CHAT_ID = '220058690'
  const USD = 44.2
  const RATE = 1.02

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
            image: item['image'] || '/images/no-image.jpg',
            brand: item['Торговая марка'] || '',
            promo: String(item['Акция'] || '')
              .toLowerCase()
              .includes('ак'),
            sizes: item['Размеры'] || ''
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
    'STYLE MARK CLIP-ON'
  ]

  const increaseQty = (id: number) => {

    const product = products.find((p) => p.id === id)

    if (!product) return

    setQuantities((prev) => ({
      ...prev,
      [id]: Math.min((prev[id] || 1) + 1, product.stock)
    }))

  }

  const decreaseQty = (id: number) => {

    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max((prev[id] || 1) - 1, 1)
    }))

  }

  const toggleCart = (product: Product) => {

    const qty = quantities[product.id] || 1

    if (cart.find((p) => p.id === product.id)) {

      setCart(cart.filter((p) => p.id !== product.id))

    } else {

      setCart([
        ...cart,
        {
          ...product,
          quantity: qty
        }
      ])

    }

  }

  const totalQty = cart.reduce(
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
      USD *
      RATE *
      p.quantity,
    0
  )

  const exportToExcel = () => {

    const wb = XLSX.utils.book_new()

    const rows: any[] = []

    rows.push(['ПІБ клієнта', clientName])
    rows.push(['Контактна інформація', clientPhone])
    rows.push(['Адреса доставки', `${clientCity}, ${clientAddress}`])
    rows.push(['Назва магазину', clientStore])
    rows.push(['Дата замовлення', new Date().toLocaleDateString()])
    rows.push([])

    rows.push([
      'Колекція',
      'Артикул',
      'Кількість',
      'Ціна грн',
      'Сума грн',
      'Сума $'
    ])

    cart.forEach((p) => {

      rows.push([
        p.brand,
        p.name,
        p.quantity,
        (p.price * USD * RATE).toFixed(2),
        (
          p.price *
          USD *
          RATE *
          p.quantity
        ).toFixed(2),
        (
          p.price *
          p.quantity
        ).toFixed(2)
      ])

    })

    rows.push([])

    rows.push([
      'РАЗОМ',
      '',
      totalQty,
      '',
      totalUah.toFixed(2),
      totalUsd.toFixed(2)
    ])

    const ws = XLSX.utils.aoa_to_sheet(rows)

    ws['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 }
    ]

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Замовлення'
    )

    const excelBuffer = XLSX.write(
      wb,
      {
        bookType: 'xlsx',
        type: 'array'
      }
    )

    const file = new Blob(
      [excelBuffer],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    )

    saveAs(
      file,
      `Замовлення_${clientName}.xlsx`
    )

  }

  const sendTelegram = async () => {

    const BOT_TOKEN = 'YOUR_BOT_TOKEN'
    const CHAT_ID = 'YOUR_CHAT_ID'

    const text = `
НОВЕ ЗАМОВЛЕННЯ

Клієнт: ${clientName}
Телефон: ${clientPhone}
Місто: ${clientCity}
Адреса: ${clientAddress}
Магазин: ${clientStore}
Менеджер: ${manager}

Сума: ${totalUah.toFixed(2)} грн
`

    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text
        })
      }
    )

  }

  const sendOrder = async () => {

    try {

      await emailjs.send(
        'YOUR_SERVICE_ID',
        'YOUR_TEMPLATE_ID',
        {
          client_name: clientName,
          client_phone: clientPhone,
          client_city: clientCity,
          client_address: clientAddress,
          client_store: clientStore,
          manager,
          total: totalUah.toFixed(2),

          products: cart.map((p) =>
            `${p.name} x${p.quantity}`
          ).join('\n')
        },
        'YOUR_PUBLIC_KEY'
      )

      await sendTelegram()

      exportToExcel()

      alert('Замовлення успішно відправлено')

      setShowCheckout(false)

    } catch (e) {

      console.error(e)

      alert('Помилка відправки')

    }

  }

  if (!authorized) {

    return (

      <div className="min-h-screen flex items-center justify-center bg-gray-200">

        <div className="bg-white p-10 rounded-2xl shadow-2xl w-80">

          <h1 className="text-3xl font-bold mb-6 text-center">
            Вхід
          </h1>

          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border w-full p-3 rounded-xl mb-4"
          />

          <button
            onClick={() => {

              if (password === SITE_PASSWORD) {
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

    <div className="p-6 bg-gray-100 min-h-screen">

      <div className="sticky top-0 z-50 bg-white p-4 rounded-2xl shadow mb-6">

        <div className="flex gap-4">

          <input
            type="text"
            placeholder="Пошук..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border p-2 rounded-lg w-full"
          />

          <select
            value={selectedBrand}
            onChange={(e) =>
              setSelectedBrand(e.target.value)
            }
            className="border p-2 rounded-lg"
          >

            {brands.map((b) => (
              <option key={b}>
                {b}
              </option>
            ))}

          </select>

        </div>

      </div>

      <div className="grid grid-cols-4 gap-6">

        <div className="col-span-3 grid grid-cols-3 gap-4">

          {products

            .filter((p) => {

              const matchesBrand =
                p.brand === selectedBrand

              const matchesSearch =
                p.name
                  .toLowerCase()
                  .includes(search.toLowerCase())

              return matchesBrand && matchesSearch

            })

            .map((p) => (

              <div
                key={p.id}
                className="bg-white p-4 rounded-2xl shadow"
              >

                <img
                  src={p.image}
                  className="h-48 w-full object-contain"
                />

                <h2 className="font-bold mt-3">
                  {p.name}
                </h2>

                <p className="text-sm text-gray-500">
                  {p.brand}
                </p>

                <p className="mt-2">
                  {p.price} $
                </p>

                <p className="text-green-700">
                  {(p.price * USD * RATE).toFixed(2)} грн
                </p>

                <div className="flex gap-2 mt-3">

                  <button
                    onClick={() => decreaseQty(p.id)}
                    className="w-8 h-8 bg-gray-200 rounded"
                  >
                    -
                  </button>

                  <div className="w-8 text-center">
                    {quantities[p.id] || 1}
                  </div>

                  <button
                    onClick={() => increaseQty(p.id)}
                    className="w-8 h-8 bg-gray-200 rounded"
                  >
                    +
                  </button>

                </div>

                <button
                  onClick={() => toggleCart(p)}
                  className="w-full mt-3 bg-blue-600 text-white py-2 rounded-xl"
                >

                  {cart.find((c) => c.id === p.id)
                    ? 'Прибрати'
                    : 'Додати'}

                </button>

              </div>

            ))}

        </div>

        <div className="bg-white rounded-2xl p-4 shadow sticky top-24 h-fit">

          <h2 className="text-2xl font-bold mb-4">
            Кошик
          </h2>

          <div className="space-y-3">

            {cart.map((p) => (

              <div
                key={p.id}
                className="border-b pb-2"
              >

                <div className="font-semibold">
                  {p.name}
                </div>

                <div className="text-sm text-gray-500">
                  {p.quantity} шт
                </div>

              </div>

            ))}

          </div>

          <div className="mt-6 border-t pt-4">

            <div className="flex justify-between">
              <span>Штук:</span>
              <span>{totalQty}</span>
            </div>

            <div className="flex justify-between font-bold mt-2">
              <span>Сума:</span>
              <span>
                {totalUah.toFixed(2)} грн
              </span>
            </div>

          </div>

          <button
            onClick={() => setShowPreview(true)}
            className="w-full mt-4 bg-gray-800 text-white py-3 rounded-xl"
          >
            Перегляд замовлення
          </button>

          <button
            onClick={() => setShowCheckout(true)}
            className="w-full mt-3 bg-green-600 text-white py-3 rounded-xl"
          >
            Зробити замовлення
          </button>

        </div>

      </div>

      {showPreview && (

        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-white w-[95%] max-w-6xl rounded-2xl p-6 max-h-[90vh] overflow-auto">

            <div className="flex justify-between items-center mb-6">

              <h2 className="text-3xl font-bold">
                Попередній перегляд
              </h2>

              <button
                onClick={() => setShowPreview(false)}
                className="text-red-500 text-2xl"
              >
                ✕
              </button>

            </div>

            <table className="w-full border-collapse">

              <thead>

                <tr className="bg-gray-100">

                  <th className="border p-3">
                    Колекція
                  </th>

                  <th className="border p-3">
                    Артикул
                  </th>

                  <th className="border p-3">
                    Фото
                  </th>

                  <th className="border p-3">
                    Акція
                  </th>

                  <th className="border p-3">
                    Ціна
                  </th>

                  <th className="border p-3">
                    Сума
                  </th>

                </tr>

              </thead>

              <tbody>

                {cart.map((p) => (

                  <tr key={p.id}>

                    <td className="border p-3">
                      {p.brand}
                    </td>

                    <td className="border p-3">
                      {p.name}
                    </td>

                    <td className="border p-3">

                      <img
                        src={p.image}
                        className="h-16 object-contain mx-auto"
                      />

                    </td>

                    <td className="border p-3 text-center">

                      {p.promo
                        ? 'АКЦІЯ'
                        : '-'}

                    </td>

                    <td className="border p-3">

                      {p.price}$

                      <br />

                      (
                      {(p.price * USD * RATE).toFixed(2)}
                      грн)

                    </td>

                    <td className="border p-3">

                      {(p.price * p.quantity).toFixed(2)}$

                      <br />

                      (
                      {(
                        p.price *
                        USD *
                        RATE *
                        p.quantity
                      ).toFixed(2)}
                      грн)

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

      )}

      {showCheckout && (

        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-white w-full max-w-lg rounded-2xl p-8">

            <h2 className="text-3xl font-bold mb-6">
              Оформлення замовлення
            </h2>

            <div className="space-y-3">

              <input
                type="text"
                placeholder="ПІБ / ФОП"
                value={clientName}
                onChange={(e) =>
                  setClientName(e.target.value)
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Телефон"
                value={clientPhone}
                onChange={(e) =>
                  setClientPhone(e.target.value)
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Місто"
                value={clientCity}
                onChange={(e) =>
                  setClientCity(e.target.value)
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Адреса"
                value={clientAddress}
                onChange={(e) =>
                  setClientAddress(e.target.value)
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Назва магазину"
                value={clientStore}
                onChange={(e) =>
                  setClientStore(e.target.value)
                }
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Менеджер"
                value={manager}
                onChange={(e) =>
                  setManager(e.target.value)
                }
                className="w-full border p-3 rounded-xl"
              />

            </div>

            <button
              onClick={sendOrder}
              className="w-full mt-6 bg-green-600 text-white py-4 rounded-xl text-lg font-bold"
            >
              Відправити замовлення
            </button>

          </div>

        </div>

      )}

    </div>

  )

}