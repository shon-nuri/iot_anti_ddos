import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../store/authStore";

export default function SignUp() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuth((s) => s.setUser);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup/", form);

      // сохраняем токены
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);

      // кладём пользователя в zustand‑store
      setUser(data.user);

      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.detail || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-zinc-800 p-8 rounded-2xl shadow"
      >
        <h1 className="text-2xl font-semibold mb-6 text-center text-white">
          Регистрация
        </h1>
        <input
          className="input mb-4"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="input mb-6"
          type="password"
          placeholder="Пароль"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading}
        >
          {loading ? "⏳" : "Создать аккаунт"}
        </button>

        <p className="text-center text-sm text-zinc-400 mt-4">
          Уже есть аккаунт?{" "}
          <Link to="/" className="text-lime-400 hover:underline">
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}
