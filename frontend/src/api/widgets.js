import axios from 'axios';
import { api as mainApi } from './client';

// создаём отдельный экземпляр для виджетов (можно и mainApi, но так чище)
export default {
  list:    () => mainApi.get('/widgets/'),
  create:  data => mainApi.post('/widgets/', data),
  update:  (id, data) => mainApi.patch(`/widgets/${id}/`, data),
  delete:  id => mainApi.delete(`/widgets/${id}/`),
  toggle:  id => mainApi.post(`/widgets/${id}/toggle/`),
  schedule:id => data => mainApi.post(`/widgets/${id}/schedule/`, data),
  threshold: id => data => mainApi.post(`/widgets/${id}/set_threshold/`, data),
  configure: id => data => mainApi.post(`/widgets/${id}/configure/`, {
    ...data,
    // Only send the chat ID; token is handled by the backend
    telegramChatId: data.telegramChatId,
  }),
};