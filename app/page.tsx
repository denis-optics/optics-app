'use client'

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  description: string;
  image: string;
  brand: string;
  promo: boolean;
  sizes: string;
};

export default function Page() {

  const SITE_PASSWORD = "optics2026";

  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [selectedBrand, setSelectedBrand] = useState("INVU");
  const [search, setSearch] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientStore, setClientStore] = useState("");
  const [manager, setManager] = useState("");

  const usdRate = 44.2;
  const markup = 1.02;

  useEffect(() => {

    fetch("https://opensheet.elk.sh/1gdR4vklSLgR1z_LmdN7IzOxzgxvEUc4DTdWq0KQReQc/Sheet1")
      .then((res) => res.json())
      .then((data) => {

        const formatted: Product[] = data.map((item: any, index: number) => ({

          id: index,

          name: item["Название"] || "Без названия",

          price: Number(
            String(item["Цена"] || "0").replace(",", ".")
          ),

          stock: Number(item["Остаток"] || 0),

          description: item["Описание"] || "",

          image: item["image"] || "/images/no-image.jpg",

          brand: item["Торговая марка"] || "",

          promo: String(item["Акция"] || "")
            .toLowerCase()
            .includes("ак"),

          sizes: item["Размеры"] || ""

        }));

        setProducts(formatted);

      });

  }, []);

  const brands = [
    "INVU",
    "STYLE MARK",
    "PERSONA",
    "INVU FRAME",
    "INVU CLIP-ON",
    "STYLE MARK CLIP-ON"
  ];

  const increaseQty = (id: number) => {

    const product = products.find((p) => p.id === id);

    if (!product) return;

    setQuantities((prev) => {

      const current = prev[id] || 1;

      if (current >= product.stock) return prev;

      return {
        ...prev,
        [id]: current + 1
      };

    });

  };

  const decreaseQty = (id: number) => {

    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max((prev[id] || 1) - 1, 1)
    }));

  };

  const toggleCart = (product: Product) => {

    const qty = Math.min(
      quantities[product.id] || 1,
      product.stock
    );

    if (cart.find((p) => p.id === product.id)) {

      setCart(
        cart.filter((p) => p.id !== product.id)
      );

    } else {

      setCart([
        ...cart,
        {
          ...product,
          quantity: qty
        }
      ]);

    }

  };

  const totalItems = cart.reduce(
    (sum, p) => sum + p.quantity,
    0
  );

  const totalUAH = cart.reduce(
    (sum, p) =>
      sum + (p.price * usdRate * markup * p.quantity),
    0
  );

  const totalUSD = cart.reduce(
    (sum, p) =>
      sum + (p.price * p.quantity),
    0
  );

  const exportToExcel = () => {

    const wb = XLSX.utils.book_new();

    const rows: any[][] = [];

    rows.push(["ФИО клиента:", clientName]);
    rows.push(["Контактная информация:", clientPhone]);
    rows.push(["Адрес доставки:", `${clientCity}, ${clientAddress}`]);
    rows.push(["Название магазина:", clientStore]);
    rows.push(["Менеджер:", manager]);
    rows.push(["Дата заказа:", new Date().toLocaleDateString("ru-RU")]);

    rows.push([]);
    rows.push([
      "Название коллекции",
      "Артикул",
      "Количество",
      "Цена за шт грн",
      "Сумма за позицию грн",
      "Сумма за позицию $"
    ]);

    cart.forEach((p) => {

      const priceUAH =
        p.price * usdRate * markup;

      const totalPositionUAH =
        priceUAH * p.quantity;

      const totalPositionUSD =
        p.price * p.quantity;

      rows.push([
        p.brand,
        p.name,
        p.quantity,
        Number(priceUAH.toFixed(2)),
        Number(totalPositionUAH.toFixed(2)),
        Number(totalPositionUSD.toFixed(2))
      ]);

    });

    rows.push([]);

    rows.push([
      "ИТОГО:",
      "",
      totalItems,
      "",
      Number(totalUAH.toFixed(2)),
      Number(totalUSD.toFixed(2))
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws["!cols"] = [
      { wch: 28 },
      { wch: 30 },
      { wch: 14 },
      { wch: 18 },
      { wch: 24 },
      { wch: 24 }
    ];

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      "Заказ"
    );

    const excelBuffer = XLSX.write(
      wb,
      {
        bookType: "xlsx",
        type: "array"
      }
    );

    const fileData = new Blob(
      [excelBuffer],
      {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    );

    saveAs(
      fileData,
      `zakaz_${clientName || "client"}.xlsx`
    );

  };

  if (!authorized) {

    return (

      <div
        className="min-h-screen flex items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/images/login-bg.jpg')"
        }}
      >

        <div className="bg-white/90 p-8 rounded-2xl shadow-2xl w-80 text-black">

          <h1 className="text-3xl font-bold mb-6 text-center">
            Вход
          </h1>

          <input
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border w-full p-3 rounded-xl mb-4 text-black"
          />

          <button
            onClick={() => {

              if (password === SITE_PASSWORD) {

                setAuthorized(true);

              } else {

                alert("Неверный пароль");

              }

            }}
            className="w-full bg-blue-600 text-white py-3 rounded-xl"
          >
            Войти
          </button>

        </div>

      </div>

    );

  }

  return (

    <div className="p-6 bg-gray-100 min-h-screen text-black">

      {/* ФИЛЬТРЫ */}

      <div className="sticky top-0 z-50 bg-white p-4 rounded-2xl shadow mb-6">

        <div className="flex gap-4">

          <input
            type="text"
            placeholder="Поиск товара..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 bg-white text-black p-2 rounded-lg shadow-sm w-full"
          />

          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="border border-gray-300 bg-white text-black p-2 rounded-lg shadow-sm"
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

        {/* ТОВАРЫ */}

        <div className="col-span-3 grid grid-cols-3 gap-4">

          {products

            .filter((p) => {

              const matchesBrand =
                selectedBrand === p.brand;

              const matchesSearch =
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.brand.toLowerCase().includes(search.toLowerCase());

              const hasStock =
                search ? true : p.stock > 0;

              return (
                matchesBrand &&
                matchesSearch &&
                hasStock
              );

            })

            .map((p) => (

              <div
                key={p.id}
                className="border rounded-2xl p-4 shadow bg-white relative text-black"
              >

                {p.promo && (

                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                    АКЦИЯ
                  </div>

                )}

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
                    src={p.image}
                    alt={p.name}
                    onClick={() => setSelectedImage(p.image)}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      cursor: "pointer"
                    }}
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
                  Размеры: {p.sizes}
                </p>

                <p className="font-semibold mt-2">

                  {p.price} $

                  <span className="text-green-700 ml-2">

                    (
                    {(p.price * usdRate * markup).toFixed(2)}
                    {" "}грн
                    )

                  </span>

                </p>

                <p className="text-sm mt-1">

                  Остаток:

                  {" "}

                  {p.stock > 5
                    ? "больше 5"
                    : p.stock}

                </p>

                <div className="flex items-center gap-2 mt-3">

                  <button
                    onClick={() => decreaseQty(p.id)}
                    className="w-8 h-8 bg-gray-300 text-black rounded"
                  >
                    −
                  </button>

                  <span className="w-6 text-center font-semibold">
                    {quantities[p.id] || 1}
                  </span>

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
                  className="mt-3 bg-blue-600 text-white px-3 py-2 rounded-xl w-full"
                >

                  {cart.find((c) => c.id === p.id)
                    ? "Убрать"
                    : "Добавить"}

                </button>

              </div>

            ))}

        </div>

        {/* КОРЗИНА */}

        <div className="border rounded-2xl p-4 shadow sticky top-24 bg-white text-black h-[85vh] overflow-y-auto">

          <h2 className="text-xl font-bold mb-4">
            Заказ
          </h2>

          <div className="space-y-3 mb-5">

            <input
              type="text"
              placeholder="ФИО / ФОП"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full border p-2 rounded-lg"
            />

            <input
              type="text"
              placeholder="Телефон"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full border p-2 rounded-lg"
            />

            <input
              type="text"
              placeholder="Город"
              value={clientCity}
              onChange={(e) => setClientCity(e.target.value)}
              className="w-full border p-2 rounded-lg"
            />

            <input
              type="text"
              placeholder="Адрес доставки"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              className="w-full border p-2 rounded-lg"
            />

            <input
              type="text"
              placeholder="Название магазина"
              value={clientStore}
              onChange={(e) => setClientStore(e.target.value)}
              className="w-full border p-2 rounded-lg"
            />

            <input
              type="text"
              placeholder="Менеджер"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              className="w-full border p-2 rounded-lg"
            />

          </div>

          <div className="max-h-[40vh] overflow-y-auto pr-2">

            {cart.map((p) => (

              <div
                key={p.id}
                className="flex items-center justify-between mb-2 text-sm gap-2 border-b pb-2"
              >

                <div className="flex items-center gap-2">

                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-10 h-10 object-contain border rounded"
                  />

                  <div>

                    <div className="truncate w-28">
                      {p.name}
                    </div>

                    <div className="text-xs text-gray-500">
                      x{p.quantity}
                    </div>

                  </div>

                </div>

                <div className="text-xs">

                  {(
                    p.price *
                    usdRate *
                    markup *
                    p.quantity
                  ).toFixed(2)}

                  {" "}грн

                </div>

                <button
                  onClick={() =>
                    setCart(
                      cart.filter((item) => item.id !== p.id)
                    )
                  }
                  className="text-red-500 text-xs"
                >
                  ✕
                </button>

              </div>

            ))}

          </div>

          <div className="mt-4 border-t pt-4 text-sm">

            <div className="flex justify-between">

              <span>Всего штук:</span>

              <span>{totalItems}</span>

            </div>

            <div className="flex justify-between font-bold mt-2">

              <span>Сумма:</span>

              <span>
                {totalUAH.toFixed(2)} грн
              </span>

            </div>

          </div>

          <button
            onClick={exportToExcel}
            className="w-full bg-black text-white py-3 rounded-xl mt-5"
          >
            Скачать Excel
          </button>

        </div>

      </div>

      {/* УВЕЛИЧЕНИЕ ФОТО */}

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
            alt=""
            style={{
              transform: "scale(1.2)",
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