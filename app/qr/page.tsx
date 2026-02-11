"use client";

import { createClient } from "@/utils/supabase/client";
import { useState, useRef, useEffect } from "react";

export default function QRPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [locked, setLocked] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locked) {
      inputRef.current?.focus();
    }
  }, [locked]);
  useEffect(() => {
    const handleClick = () => inputRef.current?.focus();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (locked) {
      // 🔥 өмнөх QR-ийг бүр мөсөн устгаад
      setUser(null);
      setError(null);
      setLocked(false);

      // 🔥 scanner аль хэдийн нэмээд биччихсэн байдаг тул
      // хамгийн сүүлийн character-оос шинээр эхлүүлнэ
      setValue(newValue.slice(-1));
      return;
    }

    setValue(newValue);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const supabase = await createClient();

    try {
      setLocked(true);
      setError(null);

      const parsed = JSON.parse(value);
      const idCardNumber = parsed.id_card_number;

      const { data, error } = await supabase
        .from("users")
        .select(
          `
          first_name,
          last_name,
          phone,
          email,
          address,
          department_name,
          position_name,
          heltes_name,
          is_active
        `
        )
        .eq("idcard_number", idCardNumber)
        .single();

      if (error) throw error;

      setUser(data);
    } catch (err: any) {
      setError("QR код буруу эсвэл хэрэглэгч олдсонгүй");
      setLocked(false);
    }
  };

  const reset = () => {
    setValue("");
    setUser(null);
    setError(null);
    setLocked(false);
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">QR Reader</h1>

      <input
        ref={inputRef}
        autoFocus
        value={value}
        disabled={false}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="QR код уншина уу..."
        className="w-full border rounded px-3 py-2"
      />

      {error && <p className="text-red-500">{error}</p>}

      {user && (
        <div className="border rounded p-4 space-y-1 bg-gray-50">
          <p>
            <b>Нэр:</b> {user.last_name} {user.first_name}
          </p>
          <p>
            <b>Утас:</b> {user.phone}
          </p>
          <p>
            <b>Хаяг:</b> {user.address}
          </p>

          <button
            onClick={reset}
            className="mt-3 px-4 py-2 bg-black text-white rounded">
            Дахин унших
          </button>
        </div>
      )}
    </div>
  );
}
