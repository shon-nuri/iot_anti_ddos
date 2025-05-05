import axios from "axios";

export const api = axios.create({
  baseURL: 'https://iot-anti-ddos.onrender.com/api/',
  withCredentials: true,
});

// Добавляем токен в каждый запрос
api.interceptors.request.use((config) => {
  const access = localStorage.getItem("access");
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// Если получаем 401 — пробуем обновить токен
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        const refresh = localStorage.getItem("refresh");
        const { data } = await api.post("/auth/refresh/", { refresh });

        // Сохраняем новый access токен
        localStorage.setItem("access", data.access);

        // Повторяем оригинальный запрос с новым токеном
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Не удалось обновить токен:", refreshError);
        // если refresh не сработал — делаем logout
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.href = "/";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
