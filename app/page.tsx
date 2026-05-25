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

export default function Page() {

  const SITE_PASSWORD = 'optics2026'

  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<any[]>([])
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

  useEffect(() => {

    fetch('https://opensheet.elk.sh/1gdR4vklSLgR1z_LmdN7IzOxzgxvEUc4DTdWq0KQReQc/Sheet1')
      .then((res) => res.json())
      .then((data) => {

        const formatted: Product[] = data.map((item: any, index: number) => ({
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
        }))

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

  const totalItems = cart.reduce(
    (sum, p) => sum + p.quantity,
    0
  )

  const totalPriceUAH = cart.reduce(
    (sum, p) =>
      sum +
      (
        p.price *
        44.2 *
        1.02 *
        p.quantity
      ),
    0
  )

  const totalPriceUSD = cart.reduce(
    (sum, p) =>
      sum +
      (
        p.price *
        p.quantity
      ),
    0
  )

  const exportToExcel = () => {

    const rows: any[] = []

    rows.push(['ПІБ клієнта', clientName])
    rows.push(['Контактна інформація', clientPhone])
    rows.push(['Адреса доставки', clientAddress])
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
        (p.price * 44.2 * 1.02).toFixed(2),
        (
          p.price *
          44.2 *
          1.02 *
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
      'Разом',
      '',
      totalItems,
      '',
      totalPriceUAH.toFixed(2),
      totalPriceUSD.toFixed(2)
    ])

    const worksheet = XLSX.utils.aoa_to_sheet(rows)

    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Замовлення'
    )

    const excelBuffer = XLSX.write(
      workbook,
      {
        bookType: 'xlsx',
        type: 'array'
      }
    )

    const fileData = new Blob(
      [excelBuffer],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    )

    saveAs(
      fileData,
      `zamovlennya_${clientName || 'client'}.xlsx`
    )

  }

  const sendOrder = async () => {

    try {

      const productsText = cart.map((p) =>
        `${p.brand} | ${p.name} | ${p.quantity} шт`
      ).join('\n')

      const res = await fetch('/api/send-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      if (!res.ok) {
        throw new Error()
      }

      exportToExcel()

      alert('Замовлення успішно відправлено')

      setShowCheckout(false)

    } catch (err) {

      alert('Помилка відправлення')

    }

  }

  if (!authorized) {

    return (

      <div
        className="min-h-screen flex items-center justify-center bg-gray-100"
      >

        <div className="bg-white p-8 rounded-2xl shadow w-80">

          <h1 className="text-3xl font-bold mb-6 text-center">
            Вхід
          </h1>

          <input
            type="password"
            placeholder="Введіть пароль"
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

    <div className="p-6 bg-gray-100 min-h-screen text-black">

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

        <div className="col-span-3 grid grid-cols-3 gap-4">

          {products

            .filter((p) => {

              const matchesBrand =
                selectedBrand === p.brand

              const matchesSearch =
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.brand.toLowerCase().includes(search.toLowerCase())

              return (
                matchesBrand &&
                matchesSearch &&
                p.stock > 0
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

                <div
                  className="h-[180px] flex items-center justify-center bg-gray-100 rounded-xl"
                >

                  <img
                    src={p.image}
                    alt={p.name}
                    onClick={() => setSelectedImage(p.image)}
                    className="max-h-full object-contain cursor-pointer"
                  />

                </div>

                <h2 className="font-bold mt-3">
                  {p.name}
                </h2>

                <p className="text-sm text-gray-500">
                  {p.brand}
                </p>

                <p className="mt-2">
                  {p.price} $
                </p>

                <p className="text-green-700 font-semibold">
                  {(p.price * 44.2 * 1.02).toFixed(2)} грн
                </p>

                <div className="flex items-center gap-2 mt-3">

                  <button
                    onClick={() => decreaseQty(p.id)}
                    className="w-8 h-8 bg-gray-300 rounded"
                  >
                    −
                  </button>

                  <span>
                    {quantities[p.id] || 1}
                  </span>

                  <button
                    onClick={() => increaseQty(p.id)}
                    className="w-8 h-8 bg-gray-300 rounded"
                  >
                    +
                  </button>

                </div>

                <button
                  onClick={() => toggleCart(p)}
                  className="mt-3 bg-blue-600 text-white px-3 py-2 rounded-xl w-full"
                >

                  {cart.find((c) => c.id === p.id)
                    ? 'Прибрати'
                    : 'Обрати'}

                </button>

              </div>

            ))}

        </div>

        <div className="border rounded-2xl p-4 shadow bg-white sticky top-24 h-[85vh] overflow-y-auto">

          <h2 className="text-xl font-bold mb-4">
            Замовлення
          </h2>

          {cart.map((p) => (

            <div
              key={p.id}
              className="flex justify-between items-center border-b pb-2 mb-2"
            >

              <div>

                <div className="font-semibold">
                  {p.name}
                </div>

                <div className="text-sm">
                  {p.quantity} шт
                </div>

              </div>

              <div className="text-sm">

                {(
                  p.price *
                  44.2 *
                  1.02 *
                  p.quantity
                ).toFixed(2)} грн

              </div>

            </div>

          ))}

          <div className="mt-4 border-t pt-4">

            <div className="flex justify-between">
              <span>Всього:</span>
              <span>{totalItems}</span>
            </div>

            <div className="flex justify-between font-bold mt-2">
              <span>Сума:</span>
              <span>{totalPriceUAH.toFixed(2)} грн</span>
            </div>

          </div>

          <button
            onClick={() => setShowPreview(true)}
            className="w-full mt-4 bg-gray-800 text-white py-3 rounded-xl"
          >
            Переглянути замовлення
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

          <div className="bg-white w-[90%] h-[85%] rounded-2xl p-6 overflow-auto">

            <div className="flex justify-between mb-4">

              <h2 className="text-2xl font-bold">
                Попередній перегляд
              </h2>

              <button
                onClick={() => setShowPreview(false)}
                className="bg-red-500 text-white px-4 py-2 rounded-xl"
              >
                Закрити
              </button>

            </div>

            <table className="w-full border">

              <thead>

                <tr className="bg-gray-200">

                  <th className="border p-2">Колекція</th>
                  <th className="border p-2">Артикул</th>
                  <th className="border p-2">Фото</th>
                  <th className="border p-2">Акція</th>
                  <th className="border p-2">Ціна</th>
                  <th className="border p-2">Сума</th>

                </tr>

              </thead>

              <tbody>

                {cart.map((p) => (

                  <tr key={p.id}>

                    <td className="border p-2">{p.brand}</td>

                    <td className="border p-2">{p.name}</td>

                    <td className="border p-2">

                      <img
                        src={p.image}
                        className="w-16 h-16 object-contain"
                      />

                    </td>

                    <td className="border p-2">

                      {p.promo ? 'АКЦІЯ' : ''}

                    </td>

                    <td className="border p-2">

                      {p.price}$

                      <br />

                      ({(p.price * 44.2 * 1.02).toFixed(2)} грн)

                    </td>

                    <td className="border p-2">

                      {(p.price * p.quantity).toFixed(2)}$

                      <br />

                      (
                      {(
                        p.price *
                        44.2 *
                        1.02 *
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

          <div className="bg-white p-8 rounded-2xl w-[500px]">

            <h2 className="text-2xl font-bold mb-6">
              Оформлення замовлення
            </h2>

            <div className="space-y-3">

              <input
                type="text"
                placeholder="ПІБ / ФОП"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full border p-3 rounded-xl"
              />

              <input
                type="text"
                placeholder="Телефон"
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
                className="flex-1 bg-green-600 text-white py-3 rounded-xl"
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
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        >

          <img
            src={selectedImage}
            className="max-w-[90%] max-h-[90%] object-contain"
          />

        </div>

      )}

    </div>

  )

}