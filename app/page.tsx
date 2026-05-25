'use client'

import React, { useState, useEffect } from 'react'

interface Product {
  id: string;
  brand: string;
  name: string;
  priceUSD: number;
  priceUAH: number;
  stock: number;
  image: string;
}

interface CartItem {
  id: string;
  brand: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export default function OpticsApp() {
  // --- СОСТОЯНИЯ ДЛЯ АВТОРИЗАЦИИ ---
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  // --- СУЩЕСТВУЮЩИЕ СОСТОЯНИЯ ДЛЯ ДАННЫХ ИЗ GOOGLE SHEETS ---
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [search, setSearch] = useState('')

  // Данные формы заказа
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientStore, setClientStore] = useState('')
  const [manager, setManager] = useState('')

  // --- ЗАГРУЗКА ДАННЫХ ИЗ GOOGLE SHEETS ---
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/get-products') 
        const data = await res.json()
        if (Array.isArray(data)) {
          setProducts(data)
        }
      } catch (err) {
        console.error("Помилка завантаження даних з Google Sheets:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // --- ОБРАБОТКА ВХОДА С ПАРОЛЕМ ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // 🔐 Проверка пароля (замените '1234' на ваш рабочий пароль)
    if (password === '1234') {
      setIsAuthenticated(true)
      setAuthError('')
    } else {
      setAuthError('Невірний пароль. Спробуйте ще раз.')
    }
  }

  // --- ЛОГИКА ВЗАИМОДЕЙСТВИЯ С КОРЗИНОЙ ---
  const addToCart = (prod: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === prod.id)
      if (existing) {
        return prev.map((item) =>
          item.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { id: prod.id, brand: prod.brand, name: prod.name, price: prod.priceUAH, quantity: 1, image: prod.image }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = item.quantity + delta
          return newQty > 0 ? { ...item, quantity: newQty } : item
        }
        return item
      })
    )
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  const totalPriceUAH = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // --- ОТПРАВКА ЗАКАЗА В TELEGRAM ---
  const sendOrder = async () => {
    if (!clientName || !clientPhone) {
      alert('Будь ласка, заповніть обов\'язкові поля: Ім\'я та Телефон')
      return
    }

    try {
      const productsText = cart
        .map((p, idx) => `${idx + 1}. ${p.brand} ${p.name} — ${p.quantity} шт. (${(p.price * p.quantity).toFixed(2)} грн)`)
        .join('\n')

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

      const data = await res.json()
      if (!res.ok) throw new Error(data.telegramDescription || data.error || 'Помилка сервера')

      alert('🚀 Замовлення успішно відправлено в Telegram!')
      setCart([])
      setShowCheckout(false)
    } catch (err: any) {
      alert(`Помилка відправлення: ${err.message || err}`)
    }
  }

  const filteredProducts = products.filter(p => 
    p.brand?.toLowerCase().includes(search.toLowerCase()) || 
    p.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {/* 🚪 ЕСЛИ НЕ АВТОРИЗОВАН — ПОКАЗЫВАЕМ КОНТРАСТНЫЙ ЭКРАН ВХОДА */}
      {!isAuthenticated ? (
        <div 
          className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=1200&q=80')" }}
        >
          {/* Темная плотная подложка для идеального контраста */}
          <div className="absolute inset-0 bg-black/75"></div>

          {/* Форма авторизации */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-black/60 p-8 shadow-2xl backdrop-blur-md">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-md">
                ОПТИКА ОПТ
              </h1>
              <p className="mt-2 text-sm font-medium text-gray-200 drop-shadow-xs">
                Введіть ваш робочий пароль для доступу до каталогу товарів
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="Введіть пароль..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/30 bg-white px-4 py-3.5 text-center text-base font-bold text-gray-900 placeholder-gray-500 shadow-inner focus:border-blue-500 focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>

              {authError && (
                <p className="text-center text-xs font-bold text-red-400 bg-red-950/50 py-2 rounded-lg border border-red-900/50">
                  ⚠️ {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 py-3.5 text-center text-base font-black text-white shadow-lg transition-all hover:bg-blue-500 active:scale-[0.99]"
              >
                Увійти в систему
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* 📦 ЕСЛИ АВТОРИЗОВАН — ПОКАЗЫВАЕМ ОСНОВНОЙ КАТАЛОГ С GOOGLE SHEETS */
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-900">
          
          {/* ИНДИКАТОР ЗАГРУЗКИ ТАБЛИЦЫ */}
          {loading ? (
            <div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-gray-500">
              Синхронізація з Google Таблицею...
            </div>
          ) : (
            <>
              {/* СТРІЧКА ПОШУКУ */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                <input
                  type="text"
                  placeholder="Пошук товару за брендом або моделлю..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:max-w-xs rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
                
                {cart.length > 0 && (
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-green-700 active:scale-95"
                  >
                    Кошик ({cart.length}) — {totalPriceUAH.toFixed(2)} грн
                  </button>
                )}
              </div>

              {/* СЕТКА ТОВАРОВ */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
                    
                    {/* Картинка товара */}
                    <div className="mb-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-50">
                      <img 
                        src={product.image || '/placeholder-sunglasses.jpg'} 
                        alt={product.name} 
                        className="h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-105" 
                      />
                    </div>

                    {/* Остатки (Если > 5, пишем "більше 5") */}
                    <div className="mb-2 flex-1">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-tight">{product.brand || 'Без бренду'}</h3>
                      <p className="text-sm font-semibold text-gray-800 truncate">{product.name || 'Модель не вказана'}</p>
                      
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <span>Залишок:</span>
                        <span className={`font-bold ${Number(product.stock) > 0 ? 'text-gray-700' : 'text-red-500'}`}>
                          {Number(product.stock) > 5 ? 'більше 5' : Number(product.stock) > 0 ? `${product.stock} шт.` : 'Немає в наявності'}
                        </span>
                      </div>
                    </div>

                    {/* Цены */}
                    <div className="mb-3 flex items-baseline gap-2">
                      <span className="text-xs font-medium text-gray-400">{Number(product.priceUSD).toFixed(2)} $</span>
                      <span className="text-base font-black text-green-600">{Number(product.priceUAH).toFixed(2)} грн</span>
                    </div>

                    {/* Кнопка купить */}
                    <button
                      onClick={() => addToCart(product)}
                      disabled={Number(product.stock) === 0}
                      className="w-full rounded-xl bg-blue-600 py-2.5 text-center text-sm font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {Number(product.stock) === 0 ? 'Завершився' : 'Обрати'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ОКНО ЗАКАЗА И ПРЕДПРОСМОТРА */}
          {showCheckout && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
              <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
                
                <div className="border-b border-gray-100 p-5">
                  <h2 className="text-xl font-black text-gray-800">Оформлення замовлення</h2>
                </div>

                {/* СКРОЛЛ ДЛЯ АНКЕТЫ И ТОВАРОВ */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  
                  {/* Поля ввода информации */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="ПІБ Клієнта"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Telephone"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Місто"
                        value={clientCity}
                        onChange={(e) => setClientCity(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Адреса доставки"
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Назва магазину"
                        value={clientStore}
                        onChange={(e) => setClientStore(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Менеджер"
                        value={manager}
                        onChange={(e) => setManager(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-green-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* СПИСОК ТОВАРОВ В КОРЗИНЕ */}
                  <div>
                    <p className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Товари у замовленні</p>
                    <div className="max-h-[200px] overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-100 bg-gray-50/50 p-2 space-y-1">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100 shadow-xs">
                          
                          <div className="flex items-center gap-3 min-w-0">
                            <img 
                              src={item.image || '/placeholder-sunglasses.jpg'} 
                              alt={item.name} 
                              className="h-10 w-10 rounded-md object-cover flex-shrink-0 bg-gray-100 border border-gray-100" 
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-gray-800">{item.brand}</p>
                              <p className="truncate text-[11px] text-gray-500">{item.name}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                              <button
                                onClick={() => item.quantity > 1 ? updateQuantity(item.id, -1) : removeFromCart(item.id)}
                                className="flex h-5 w-5 items-center justify-center rounded bg-white text-xs font-bold text-gray-600 shadow-xs hover:bg-gray-100"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-xs font-bold text-gray-800">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="flex h-5 w-5 items-center justify-center rounded bg-white text-xs font-bold text-gray-600 shadow-xs hover:bg-gray-100"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-right min-w-[65px]">
                              <p className="text-xs font-black text-gray-800">{(item.price * item.quantity).toFixed(2)} ₴</p>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* ЗАКРЕПЛЕННЫЙ ПОДВАЛ КОРЗИНЫ */}
                <div className="border-t border-gray-100 bg-gray-50 p-5 rounded-b-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Всього позицій: {cart.length}</span>
                    <p className="text-lg font-black text-gray-800">
                      Сума: <span className="text-green-600">{totalPriceUAH.toFixed(2)} грн</span>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCheckout(false)}
                      className="flex-1 rounded-xl bg-gray-200 py-3 text-center text-sm font-bold text-gray-600 transition-colors hover:bg-gray-300"
                    >
                      Скасувати
                </button>
                    <button
                      onClick={sendOrder}
                      className="flex-1 rounded-xl bg-green-600 py-3 text-center text-sm font-bold text-white shadow-md transition-colors hover:bg-green-700"
                    >
                      Відкрити й зберегти
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      )}
    </>
  )
}