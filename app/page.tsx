'use client'

import { useState } from "react";
import * as XLSX from "xlsx";

export default function Page() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<any>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
const [selectedBrand, setSelectedBrand] = useState<string>("Все");
  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (evt: any) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      const formatted = jsonData.map((item: any, index) => ({
        id: index,
        name: item["Название"] || "Без названия",
        price: Number(item["Цена"] || 0),
        stock: item["Остаток"] || "",
        description: item["Описание"] || "",
        image: item["image"] || "/images/no-image.jpg",
        brand: item["Торговая марка"] || "",
        promo: !!item["Акция"]
      }));

      setProducts(formatted);
    };

    reader.readAsArrayBuffer(file);
  };

  const toggleCart = (product: any) => {
    const qty = Math.min(quantities[product.id] || 1, product.stock);

    if (cart.find((p) => p.id === product.id)) {
      setCart(cart.filter((p) => p.id !== product.id));
    } else {
      setCart([...cart, { ...product, quantity: qty }]);
    }
  };

  const increaseQty = (id: number) => {
  const product = products.find(p => p.id === id);
  if (!product) return;

  setQuantities((prev: any) => {
    const current = prev[id] || 1;

    if (current >= product.stock) {
      return prev; // не увеличиваем
    }

    return {
      ...prev,
      [id]: current + 1
    };
  });
};
  const decreaseQty = (id: number) => {
    setQuantities((prev: any) => ({
      ...prev,
      [id]: Math.max((prev[id] || 1) - 1, 1)
    }));
  };
const brands = ["Все", ...Array.from(new Set(products.map(p => p.brand).filter(Boolean)))];
const totalItems = cart.reduce((sum, p) => sum + (p.quantity || 1), 0);

const totalPrice = cart.reduce(
  (sum, p) => sum + p.price * (p.quantity || 1),
  0
);
  return (
    <div className="p-6">

      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
<div className="mt-4">
  <select
  value={selectedBrand}
  onChange={(e) => setSelectedBrand(e.target.value)}
  className="border border-gray-300 bg-white text-black p-2 rounded-lg shadow-sm"
>
    {brands.map((b) => (
      <option key={b} value={b}>
        {b}
      </option>
    ))}
  </select>
</div>
      <div className="grid grid-cols-4 gap-6 mt-6">

        {/* ТОВАРЫ */}
        <div className="col-span-3 grid grid-cols-3 gap-4">
          {products
  .filter((p) => selectedBrand === "Все" || p.brand === selectedBrand)
  .map((p) => (
            <div key={p.id} className="border rounded-2xl p-4 shadow relative">

              {/* БЕЙДЖ АКЦИИ */}
              {p.promo && (
                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                  АКЦИЯ
                </div>
              )}

              {/* КАРТИНКА */}
              <div
                style={{
                  width: "100%",
                  height: "180px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f5f5f5",
                  borderRadius: "12px",
                  padding: "8px"
                }}
              >
                <img
                  src={p.image || "/images/no-image.jpg"}
                  alt="img"
                  onClick={() => setSelectedImage(p.image)}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    cursor: "pointer"
                  }}
                />
              </div>

              {/* НАЗВАНИЕ */}
              <h2 className="text-lg font-bold mt-2">{p.name}</h2>

              {/* БРЕНД (ОДИН РАЗ!) */}
               <p className="text-sm text-gray-500">{p.brand}</p>

              {/* ОПИСАНИЕ */}
              <p>{p.description}</p>

              {/* ЦЕНА */}
              <p className="font-semibold">{p.price} грн</p>

              {/* ОСТАТОК */}
              <p className="text-sm">
  Остаток: {p.stock > 5 ? "больше 5" : p.stock}
</p>
              {/* КОЛИЧЕСТВО */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => decreaseQty(p.id)}
                  className="w-8 h-8 bg-gray-300 text-black rounded flex items-center justify-center"
                >
                  −
                </button>

                <span className="w-6 text-center font-semibold">
                  {quantities[p.id] || 1}
                </span>

                
                 <button
  onClick={() => increaseQty(p.id)}
  disabled={(quantities[p.id] || 1) >= p.stock}
  className={`w-8 h-8 rounded flex items-center justify-center ${
    (quantities[p.id] || 1) >= p.stock
      ? "bg-gray-200 text-gray-400"
      : "bg-gray-300 text-black"
  }`}
>
  +
</button>
                 
              </div>

              {/* КНОПКА */}
              <button
                onClick={() => toggleCart(p)}
                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded-xl w-full"
              >
                {cart.find((c) => c.id === p.id) ? "Убрать" : "Выбрать"}
              </button>

            </div>
          ))}
        </div>

        {/* КОРЗИНА */}
        <div className="border rounded-2xl p-4 shadow">
          <h2 className="text-xl font-bold mb-2">Заказ</h2>

         {cart.map((p) => (
  <div key={p.id} className="flex items-center justify-between mb-1 text-sm gap-2">
    
    <span className="truncate w-28">
      {p.name} (x{p.quantity})
    </span>

    <span className="text-xs">
      {p.price} грн
    </span>

    <button
      onClick={() => setCart(cart.filter(item => item.id !== p.id))}
      className="text-red-500 text-xs"
    >
      ✕
    </button>

  </div>
))}
<div className="mt-4 border-t pt-2 text-sm">
  <div className="flex justify-between">
    <span>Всего штук:</span>
    <span>{totalItems}</span>
  </div>

  <div className="flex justify-between font-bold">
    <span>Сумма:</span>
    <span>{totalPrice.toFixed(2)} грн</span>
  </div>
</div>
          <button className="mt-4 w-full bg-green-600 text-white py-2 rounded-xl">
            Оформить заказ
          </button>
        </div>

      </div>

      {/* УВЕЛИЧЕНИЕ КАРТИНКИ */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <img
            src={selectedImage}
            style={{
              transform: "scale(1.3)",
              maxWidth: "90%",
              maxHeight: "90%",
              objectFit: "contain"
            }}
          />
        </div>
      )}

    </div>
  );
}