import { useState } from 'react';
import widgetsApi from '../../api/widgets';
import { api } from '../../api/client';

/**
 * AlarmWidget
 * — хранит пороги для температуры, DDoS, неправильных паролей
 * — отправляет тестовое сообщение в Telegram после сохранения
 */
export default function AlarmWidget({ widget, reload = () => {}, remove = () => {} }) {
  /* локальная копия конфигурации */
  const [config, setConfig] = useState({
    tempThreshold:      widget.config?.tempThreshold              ?? 30,
    requestThreshold:   widget.config?.requestThreshold           ?? 10,
    wrongPassAttempts:  widget.config?.wrongPassAttemptsThreshold ?? 3,
    telegramToken:      widget.config?.telegramToken              ?? '',
    telegramChatId:     widget.config?.telegramChatId             ?? '',
  });

  /** универсальный onChange для инпутов */
  const handleChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]:
        key === 'telegramToken' || key === 'telegramChatId'
          ? value
          : Number(value),
    }));
  };

  /** прямой вызов Telegram API */
  const sendTelegram = async message => {
    const token  =
      config.telegramToken.trim() ||
      import.meta.env.VITE_TG_TOKEN ||
      'DEFAULT_TOKEN';
    const chatId =
      config.telegramChatId.trim() ||
      import.meta.env.VITE_TG_CHAT  ||
      'DEFAULT_CHAT';

    if (!token || !chatId) return console.warn('No Telegram creds');

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ chat_id: chatId, text: message }),
      });
    } catch (err) {
      console.error('Telegram send failed', err);
    }
  };

  /** сохранить конфиг на бэкенд */
  const saveConfig = async () => {
    try {
      await widgetsApi.update(widget.id, { config });
      await api.post(`/widgets/${widget.id}/configure/`, { ...config });

      // тестовое сообщение
      await sendTelegram(`✅ Settings for «${widget.title}» saved.`);
      reload();
      alert('Настройки сохранены');
    } catch (err) {
      console.error('Save config error', err);
      alert('Ошибка при сохранении настроек');
    }
  };

  /* вспомогательные триггеры – если нужно вызвать вручную */
  const handleTemperatureAlert = async value => {
    try {
      await widgetsApi.configure(widget.id)({
        config: { event_type: 'temperature', value },
      });
    } catch (err) {
      console.error('Temp alert send failed', err);
    }
  };

  const handleWrongPasswordAlert = async attempts => {
    try {
      await widgetsApi.configure(widget.id)({
        config: { event_type: 'wrong_password', attempts },
      });
    } catch (err) {
      console.error('Wrong‑pwd alert send failed', err);
    }
  };

  /* ------------------- UI ------------------- */
  return (
    <div className="bg-zinc-800 p-4 rounded relative">
      <button
        onClick={remove}
        className="absolute top-2 right-2 text-zinc-500 hover:text-red-500"
      >
        ×
      </button>

      <h3 className="text-white mb-4">{widget.title}</h3>

      <div className="space-y-4">
        {/* temperature */}
        <div className="flex items-center gap-2">
          <label className="text-white text-sm">Temperature Alert (°C):</label>
          <input
            type="number"
            value={config.tempThreshold}
            onChange={e => handleChange('tempThreshold', e.target.value)}
            className="w-20 bg-zinc-700 text-white rounded px-2 py-1"
          />
        </div>

        {/* requests/sec */}
        <div className="flex items-center gap-2">
          <label className="text-white text-sm">Max Requests/sec:</label>
          <input
            type="number"
            value={config.requestThreshold}
            onChange={e => handleChange('requestThreshold', e.target.value)}
            className="w-20 bg-zinc-700 text-white rounded px-2 py-1"
          />
        </div>

        {/* wrong passwords */}
        <div className="flex items-center gap-2">
          <label className="text-white text-sm">Max Wrong Passwords:</label>
          <input
            type="number"
            value={config.wrongPassAttempts}
            onChange={e => handleChange('wrongPassAttempts', e.target.value)}
            className="w-20 bg-zinc-700 text-white rounded px-2 py-1"
          />
        </div>

        {/* Telegram creds */}
        <div className="pt-4 border-t border-zinc-700">
          <h4 className="text-white text-sm font-semibold mb-3">
            Telegram Settings
          </h4>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm">Bot Token:</label>
              <input
                type="text"
                value={config.telegramToken}
                onChange={e => handleChange('telegramToken', e.target.value)}
                placeholder="123456:ABC‑DEF..."
                className="w-full bg-zinc-700 text-white rounded px-2 py-1"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white text-sm">Chat ID:</label>
              <input
                type="text"
                value={config.telegramChatId}
                onChange={e => handleChange('telegramChatId', e.target.value)}
                placeholder="123456789"
                className="w-full bg-zinc-700 text-white rounded px-2 py-1"
              />
            </div>
          </div>
        </div>

        <button
          onClick={saveConfig}
          className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
