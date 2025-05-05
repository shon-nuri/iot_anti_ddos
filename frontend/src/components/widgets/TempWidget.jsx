import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { api } from '../../api/client';

export default function TempWidget({ widget, onRemove, remove = () => {} }) {
  if (!widget) return null;
  
  const [temperature, setTemperature] = useState(null);
  const [tempLog, setTempLog] = useState([]);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine temperature color based on value
  const getTemperatureColor = (temp) => {
    if (temp === null) return 'text-gray-400';
    if (temp < 10) return 'text-blue-400';
    if (temp < 22) return 'text-lime-400';
    if (temp < 28) return 'text-yellow-400';
    return 'text-red-500';
  };

  const checkTemperatureAlert = async (temp) => {
    const threshold = widget.config?.tempThreshold;
    if (threshold && temp >= threshold) {
      try {
        await api.post(`/widgets/${widget.id}/configure/`, {
          config: {
            event_type: 'temperature',
            value: temp
          }
        });
      } catch (err) {
        console.error('Failed to send temperature alert:', err);
      }
    }
  };

  const updateIntervalOnServer = async (secs) => {
    try {
      await api.post("/interval/", { interval: secs });
      setRefreshInterval(secs * 1000);
    } catch (err) {
      setError("Не удалось обновить интервал");
      console.error("Не удалось сохранить интервал на сервере:", err);
      setTimeout(() => setError(null), 3000);
    }
  };
  
  // Example for AlarmWidget.jsx or DoorWidget.jsx:
const sendTelegram = async (message) => {
  const token = (widget.config?.telegramToken || "").trim() || "7849455435:AAGaEoIRwPEgy19Vb-TYEDAqi_NgBl-qFJI";
  const chatId = (widget.config?.telegramChatId || "").trim() || "983787718";

  if (!token || !chatId) {
    console.error("Telegram token or chat ID is missing");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });
    console.log("Telegram message sent successfully");
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
};
  
  const fetchTemperature = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/temperature/`);
  
      if (response.data && response.data.length > 0) {
        const latestTemp = response.data[0].value;
        setTemperature(latestTemp);
  
        // Send Telegram message if temperature exceeds 30°C
        if (latestTemp > 31) {
          sendTelegram(`🌡️ Temperature Alert: ${latestTemp}°C exceeds the threshold of 31°C.`);
        }
  
        // Update temperature log
        setTempLog(
          response.data.map(t => ({
            time: new Date(t.created_at).toLocaleTimeString(),
            value: t.value,
          }))
        );
      }
  
      setError(null);
    } catch (err) {
      console.error('Failed to fetch temperature:', err);
      setError('Failed to fetch temperature data');
    } finally {
      setLoading(false);
    }
  };

  // Add useEffect to fetch temperature on mount and interval
  useEffect(() => {
    fetchTemperature();
    const interval = setInterval(fetchTemperature, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);
  
  return (
    <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 p-5 rounded-2xl shadow-lg border border-zinc-700 relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-zinc-600">
      {/* Widget Header */}
      <div className="flex justify-between items-center mb-4">
      <button
        onClick={remove}
        className="absolute top-2 right-2 text-zinc-500 hover:text-red-500"
        >
        ×
        </button>
        <h3 className="text-lg font-bold text-white flex items-center">
          <span className="mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
            </svg>
          </span>
          {widget.title}
        </h3>
      </div>

      {/* Temperature Value Display */}
      <div className="flex justify-center items-center h-24 mb-3">
        {loading && temperature === null ? (
          <div className="animate-pulse flex space-x-2 items-center">
            <div className="h-6 w-6 bg-zinc-600 rounded-full"></div>
            <div className="h-4 w-24 bg-zinc-600 rounded"></div>
          </div>
        ) : (
          <div className={`text-4xl font-bold ${getTemperatureColor(temperature)} transition-colors duration-300`}>
            {temperature !== null
              ? `${temperature.toFixed(1)}°C`
              : '—°C'}
            
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 text-red-200 p-2 rounded-lg mb-4 text-sm text-center">
          {error}
        </div>
      )}

      {/* Refresh Interval Controls */}
      <div className="flex items-center justify-center mb-4 bg-zinc-700/30 p-2 rounded-lg">
        <label className="text-zinc-300 text-sm mr-2">Интервал:</label>
        <input
          type="range"
          min="1"
          max="300"
          value={refreshInterval / 1000}
          onChange={e => updateIntervalOnServer(Number(e.target.value))}
          className="w-24 accent-lime-500"
        />
        <span className="text-zinc-300 text-sm ml-2 w-16">
          {refreshInterval / 1000} сек
        </span>
      </div>

      {/* Temperature Chart */}
      {tempLog.length > 0 && (
        <div className="mt-2 bg-zinc-800/50 p-2 rounded-lg">
          <Line
            data={{
              labels: tempLog.map(t => t.time),
              datasets: [{
                label: 'Температура, °C',
                data: tempLog.map(t => t.value),
                borderColor: 'rgb(132, 204, 22)',
                backgroundColor: 'rgba(132, 204, 22, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              height: 200,
              scales: {
                y: {
                  beginAtZero: false,
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.6)',
                  }
                },
                x: {
                  grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.6)',
                    maxRotation: 45,
                    minRotation: 45,
                  }
                }
              },
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  titleColor: 'rgb(132, 204, 22)',
                  bodyColor: 'white',
                  borderColor: 'rgb(132, 204, 22)',
                  borderWidth: 1,
                  padding: 10,
                  displayColors: false
                }
              },
            }}
            height={200}
          />
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center mt-3">
        <button 
          onClick={fetchTemperature}
          disabled={loading}
          className={`text-xs px-3 py-1 rounded-full flex items-center ${
            loading 
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
              : 'bg-lime-600 hover:bg-lime-500 text-white'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Обновление...
            </>
          ) : (
            <>
              <svg className="mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Обновить данные
            </>
          )}
        </button>
      </div>
    </div>
  );
}