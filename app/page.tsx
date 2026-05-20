/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useEffect } from "react";

export default function Page() {

  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<any>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("Все");

  // 🔥 ЗАГРУЗКА ИЗ GOOGLE SHEETS
  useEffect(() => {
    fetch("https://opensheet.elk.sh/1gdR4vklSLgR1z_LmdN7IzOxzgxvEUc4DTdWq0KQReQc/Sheet1")
      .then((res) => res.json())
      .then((data) => {
        const formatted = data.map((item: any, index: number) => ({
          id: index,
          name: item["Название"] || "Без названия",
          price: parseFloat(
  String(item["Цена"])
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
) || 0,
          stock: Number(item["Остаток"] || 0),
          description: item["Описание"] || "",
          image: item["image"] || "/images/no-image.jpg",
          brand: item["Торговая марка"] || "",
          promo: ["да", "yes", "1", "true", "акція"].includes(
  String(item["Акция"]).trim().toLowerCase()
)
        }));

        setProducts(formatted);
      });
  }, []);

  // 🛒 ДОБАВИТЬ В КОРЗИНУ
  const toggleCart = (product: any) => {
    const qty = Math.min(quantities[product.id] || 1, product.stock);

    if (cart.find((p) => p.id === product.id)) {
      setCart(cart.filter((p) => p.id !== product.id));
    } else {
      setCart([...cart, { ...product, quantity: qty }]);
    }
  };

  // ➕ УВЕЛИЧИТЬ КОЛ-ВО
  const increaseQty = (id: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    setQuantities((prev: any) => {
      const current = prev[id] || 1;

      if (current >= product.stock) return prev;

      return { ...prev, [id]: current + 1 };
    });
  };

  // ➖ УМЕНЬШИТЬ
  const decreaseQty = (id: number) => {
    setQuantities((prev: any) => ({
      ...prev,
      [id]: Math.max((prev[id] || 1) - 1, 1)
    }));
  };

  // 📊 ФИЛЬТРЫ И СУММЫ
  const brands = ["Все", ...Array.from(new Set(products.map(p => p.brand).filter(Boolean)))];

  const totalItems = cart.reduce((sum, p) => sum + (p.quantity || 1), 0);

  const totalPrice = cart.reduce(
    (sum, p) => sum + p.price * (p.quantity || 1),
    0
  );

  return (
    <div className="p-6">

      {/* ФИЛЬТР */}
      <div className="mb-4">
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="border border-gray-300 bg-white text-black p-2 rounded-lg"
        >
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-4 gap-6">

        {/* ТОВАРЫ */}
        <div className="col-span-3 grid grid-cols-3 gap-4">
          {products
            .filter((p) => selectedBrand === "Все" || p.brand === selectedBrand)
            .map((p) => (
              <div key={p.id} className="border rounded-2xl p-4 shadow relative">

                {/* АКЦИЯ */}
                {p.promo && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                    АКЦИЯ
                  </div>
                )}

                {/* КАРТИНКА */}
                <div className="h-[180px] flex items-center justify-center bg-gray-100 rounded">
                  <img
                    src={p.image}
                    onClick={() => setSelectedImage(p.image)}
                    className="max-h-full max-w-full object-contain cursor-pointer"
                  />
                </div>

                <h2 className="font-bold mt-2">{p.name}</h2>
                <p className="text-sm text-gray-500">{p.brand}</p>
                <p>{p.description}</p>
                <p className="font-semibold">{p.price} грн</p>

                <p className="text-sm">
                  Остаток: {p.stock > 5 ? "больше 5" : p.stock}
                </p>

                {/* КОЛИЧЕСТВО */}
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => decreaseQty(p.id)} className="w-8 h-8 bg-gray-300 text-black rounded">
                    −
                  </button>

                  <span>{quantities[p.id] || 1}</span>

                  <button
                    onClick={() => increaseQty(p.id)}
                    disabled={(quantities[p.id] || 1) >= p.stock}
                    className="w-8 h-8 bg-gray-300 text-black rounded"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => toggleCart(p)}
                  className="mt-2 bg-blue-600 text-white w-full py-1 rounded"
                >
                  {cart.find((c) => c.id === p.id) ? "Убрать" : "Выбрать"}
                </button>

              </div>
            ))}
        </div>

        {/* КОРЗИНА */}
        <div className="border rounded-2xl p-4 shadow">
          <h2 className="font-bold mb-2">Заказ</h2>

          {cart.map((p) => (
            <div key={p.id} className="flex justify-between text-sm mb-1">
              <span>{p.name} (x{p.quantity})</span>

              <div className="flex items-center gap-2">
                <span>{p.price}</span>
                <button
                  onClick={() => setCart(cart.filter(i => i.id !== p.id))}
                  className="text-red-500"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <div className="mt-3 text-sm border-t pt-2">
            <div className="flex justify-between">
              <span>Всего:</span>
              <span>{totalItems}</span>
            </div>

            <div className="flex justify-between font-bold">
              <span>Сумма:</span>
              <span>{totalPrice.toFixed(2)} грн</span>
            </div>
          </div>

          <button className="mt-4 w-full bg-green-600 text-white py-2 rounded">
            Оформить заказ
          </button>
        </div>

      </div>

      {/* ОВЕРЛЕЙ */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center"
        >
          <img
            src={selectedImage}
            className="max-w-[90%] max-h-[90%] object-contain"
          />
        </div>
      )}

    </div>
  );
}