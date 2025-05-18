import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../store/authStore";
import { Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPw] = useState("");
  const navigate   = useNavigate();
  const setUser    = useAuth((s) => s.setUser);

  /** отправляем форму */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1) получаем токены и сохраняем ответ
      const { data } = await api.post("/auth/token/", { email, password });
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
  
      // 2) забираем профиль
      const me = await api.get("/users/me/").then((r) => r.data);
      setUser(me);
  
      // 3) уходим на дашборд
      navigate("/dashboard");
    } catch (err) {
      console.error(err.response?.data || err.message);  // ← чтобы видеть реальную ошибку
      alert("Неверные учётные данные");
    }
  };
  

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <form
        onSubmit={handleSubmit}                      
        className="w-full max-w-sm bg-zinc-800 p-8 rounded-2xl shadow"
      >
        <h1 className="text-2xl font-semibold mb-6 text-center text-white">
          Вход
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mb-4"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPw(e.target.value)}
          className="input mb-6"
        />

        <button type="submit" className="btn-primary w-full">
          Войти
        </button>
        <p className="text-center text-sm text-zinc-400 mt-4">
          Нет аккаунта?{" "}
          <Link to="/signup" className="text-lime-400 hover:underline">
            Регистрация
          </Link>
        </p>
      </form>
    </div>
  );
}
