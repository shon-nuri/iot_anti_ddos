import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../store/authStore";

export default function SignUp() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuth((s) => s.setUser);

  // --- та же компонента, только несколько мелких правок ------------------
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
        setError("Введите email и пароль");
        return;
    }
    setLoading(true);
    try {
        const { data } = await api.post("/auth/signup/", form);

        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
        setUser(data.user);

        navigate("/dashboard");
    } catch (err) {
        setError(
        err.response?.data?.detail ||
        err.response?.data?.email?.[0] ||
        "Ошибка регистрации"
        );
    } finally {
        setLoading(false);
    }
    };
    
    {error && (
    <p className="text-red-400 text-center text-sm mb-4">{error}</p>
    )}


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
