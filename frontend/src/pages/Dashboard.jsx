import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client"; // Assuming api client is configured
// Removed Line import as temperature graph is removed
import {
  Chart as ChartJS,
  LineElement, PointElement, 
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  LineElement, PointElement, 
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

// Assuming WidgetContainer is imported correctly
import WidgetContainer from '../components/widgets/WidgetContainer';
import { useAuth } from "../store/authStore.js";

export default function Dashboard() {
  // --- State Variables ---
  const [autoBlockEnabled, setAutoBlockEnabled] = useState(false);
  const [autoBlockThreshold, setAutoBlockThreshold] = useState(7);
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackLogs, setAttackLogs] = useState([]); // Stores attack simulation logs
  const [attackIntervalId, setAttackIntervalId] = useState(null);
  const queryClient = useQueryClient(); // For React Query cache invalidation
  const [newDevice, setNewDevice] = useState({ name: "", ip: "", mac: "" }); // For the add device form
  const [discoveredDevices, setDiscoveredDevices] = useState([]); // Devices found by network scan
  const [knownIPs, setKnownIPs] = useState(new Set()); // IPs found during discovery (unused in current logic, but kept)
  const [refreshInterval, setRefreshInterval] = useState(5000); // Interval for device refresh (used in useQuery)
  const [newDeviceNotification, setNewDeviceNotification] = useState(null); // State for the notification popup
  const user = useAuth((s) => s.user);
  const [localWidgets, setLocalWidgets] = useState([]);
  const refreshWidgets = () => queryClient.invalidateQueries(['widgets'])
  // --- Widget Management ---

  const { data: widgetsServer = [], isLoading: widgetsLoading } = useQuery({
    queryKey: ['widgets'],
    queryFn : () => api.get('/widgets/').then(r => r.data),
    refetchInterval: 5000,
  })

  const handleStartDDoS = async () => {
    try {
      await api.post('/ddos/alert/');
      alert('DDoS alert sent to all alarm widgets.');
    } catch (err) {
      console.error('Failed to send DDoS alert:', err);
      alert('Ошибка при отправке уведомления о DDoS.');
    }
  };

  const {
    data: devices = [],
    isLoading,
    isError,
    error: fetchError,
  } = useQuery({
    queryKey: ["devices"],
    queryFn: () => api.get("/devices/").then((r) => r.data),
    refetchInterval: 5000,
  });


  /* 1. нормализуем структуру с бэка → фронту  */
  useEffect(() => {
    const normalized = widgetsServer.map(w => ({ ...w, type: w.wtype }))
    .sort((a, b) => a.id - b.id)

    setLocalWidgets(prev => {
      /* сравниваем по id и updated_at (или created) —
        если ничего не поменялось, стейт НЕ трогаем */
      const same =
        prev.length === normalized.length &&
        prev.every((p, i) =>
          p.id === normalized[i].id &&
          p.updated === normalized[i].updated   // ← замените на своё поле‑метку
        )

      return same ? prev : normalized
    })
  }, [widgetsServer])


  const addWidgetMutation = useMutation({
      mutationFn : (payload) => api.post('/widgets/', payload).then(r => r.data),
      /* onSuccess → replace draft with real */
      onSuccess  : (real) => {
        setLocalWidgets(ws =>
          ws.map(w => (w.__draft && w.tmpKey === real.tmpKey) ? {...real, type: real.wtype} : w)
        )
        queryClient.invalidateQueries(['widgets'])   // keep server cache in sync
      },
      /* onError → remove the draft */
      onError    : (_, __, ctx) => {
        setLocalWidgets(ws => ws.filter(w => !w.__draft || w.tmpKey !== ctx.tmpKey))
      }
    })
/* handleAddWidget (replace whole function) */
const handleAddWidget = (type) => {
  const titles = { light:'Свет', door:'Дверь', temp:'Температура', alarm:'Алерт' }
  const tmpKey = Date.now()          // key to find draft later

  // optimistic draft
  const draft = {
    id      : tmpKey,                // temporary id just for React key
    tmpKey,                          // keep to identify after response
    __draft : true,                  // flag
    type,
    wtype   : type,
    title   : titles[type] || 'Виджет',
    config  : { schedule: 5 },
  }
  setLocalWidgets(ws => [...ws, draft])

  addWidgetMutation.mutate(
    { title:draft.title, wtype:draft.wtype, config:draft.config, tmpKey }, // tmpKey echoed back
    { tmpKey }     // <-  passed as mutation context => ctx
  )
}

  /* delete widget */
  const deleteWidgetMutation = useMutation({
    mutationFn: (id) => api.delete(`/widgets/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(["widgets"]),
  });

  /* удалить виджет */
  const handleRemoveWidget = (id) => deleteWidgetMutation.mutate(id);

  // Mutation for adding a new device
  const addDeviceMutation = useMutation({
    mutationFn: (device) => api.post("/devices/", device),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] }); // Invalidate devices query
      setNewDevice({ name: "", ip: "", mac: "" });
      // Removed setNewDeviceNotification logic from here
    },
    onError: (error) => {
      console.error("Error adding device:", error);
      alert(`Ошибка добавления устройства: ${error.response?.data?.detail || error.message}. Проверьте введенные данные и логи сервера.`);
    }
  });

  // Mutation for deleting a device
  const deleteDeviceMutation = useMutation({
    mutationFn: (id) => api.delete(`/devices/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] }); // Invalidate devices query
      // Removed setNewDeviceNotification logic from here
    },
    onError: (error) => {
      console.error("Error deleting device:", error);
      alert(`Ошибка удаления устройства: ${error.response?.data?.detail || error.message}`);
    }
  });

  // Mutation for toggling the network shield
  const toggleShieldMutation = useMutation({
    mutationFn: (enabled) => api.post("/shield/toggle/", { enabled }),
    onSuccess: (data) => {
      console.log("Shield toggle success:", data);
    },
    onError: (error) => {
      console.error("Error toggling shield:", error);
      alert(`Ошибка переключения защиты: ${error.response?.data?.detail || error.message}`);
    }
  });

  // --- Event Handlers ---

  // Handle form submission for adding a device manually
  const handleAddDevice = (e) => {
    e.preventDefault();
    if (newDevice.name && newDevice.ip && newDevice.mac) {
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(newDevice.mac)) {
            alert("Неверный формат MAC адреса. Используйте формат AA:BB:CC:DD:EE:FF.");
            return;
        }
        const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (!ipRegex.test(newDevice.ip)) {
             alert("Неверный формат IP адреса.");
             return;
        }

        // Include the owner field
        addDeviceMutation.mutate({
            ...newDevice,
            owner: user?.id, // Assuming user object has an 'id' field
        });

    } else {
        alert("Пожалуйста, заполните все поля.");
    }
  };


  // Handle clicking the delete button for a device
  const handleDeleteDevice = (id) => {
    if (confirm("Удалить это устройство?")) {
      deleteDeviceMutation.mutate(id);
    }
  };

  // Handle toggling the shield on or off
  const handleShieldToggle = (enabled) => {
    toggleShieldMutation.mutate(enabled);
  };

  // Handle network discovery process
  const handleDiscoverDevices = async () => {
    try {
      const response = await api.get("/discover/");
      const foundDevices = response.data;

      // Update the discoveredDevices state - DO NOT set notification here
      setDiscoveredDevices(foundDevices.filter(d => d && d.ip && d.mac));

      // Update knownIPs set (optional, but good practice)
      const ips = new Set(foundDevices.filter(d => d && d.ip).map((d) => d.ip));
      setKnownIPs(ips);

      // Removed setNewDeviceNotification logic from here

    } catch (error) {
      console.error("Ошибка при сканировании сети:", error);
      alert(`Ошибка сканирования сети: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Handle adding a device directly from the discovered list or notification
  const handleAddDiscoveredDevice = (device) => {
    if (device.ip && device.mac) {
        // Use the same mutation as the manual add form, including owner
        addDeviceMutation.mutate({
            name: device.hostname || `Discovered ${device.ip}`,
            ip: device.ip,
            mac: device.mac,
            owner: user?.id, // Assuming user object has an 'id' field
        });
        // Removed setNewDeviceNotification logic from here as well
    } else {
        console.warn("Attempted to add discovered device with missing IP or MAC:", device);
        alert("Невозможно добавить устройство: отсутствует IP или MAC адрес.");
    }
  };


  // Handle toggling the DDoS simulation
  const toggleAttack = () => {
    if (isAttacking) {
      if (attackIntervalId) {
        clearInterval(attackIntervalId);
        setAttackIntervalId(null);
      }
      setIsAttacking(false);
      return;
    }

    const targets = discoveredDevices.filter(d => d && d.ip);
    if (targets.length === 0) {
        alert("Сначала выполните сканирование сети, чтобы найти цели для атаки.");
        return;
    }

    setIsAttacking(true);

    const interval = setInterval(() => {
      targets.forEach((device) => {
        fetch(`http://${device.ip}`, { method: "GET", mode: 'no-cors', cache: 'no-store' })
          .then((res) => {
            setAttackLogs((prev) => [
              { ip: device.ip, status: `(no-cors ${res.type})`, ok: false, time: new Date().toLocaleTimeString() },
              ...prev.slice(0, 49),
            ]);
          })
          .catch((err) => {
            const errorMessage = err?.message || "Network Error";
            setAttackLogs((prev) => [
              {
                ip: device.ip,
                status: errorMessage,
                ok: false,
                time: new Date().toLocaleTimeString(),
              },
              ...prev.slice(0, 49),
            ]);
          });
      });
    }, 1000);

    setAttackIntervalId(interval);
  };

  // --- Effects ---

  // Effect for periodic network discovery
  useEffect(() => {
    // Run discovery immediately on component mount
    handleDiscoverDevices();
    // Set up interval to run discovery periodically
    const interval = setInterval(handleDiscoverDevices, 30000); // 30 seconds

    // Cleanup function: clear the interval when the component unmounts
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs once on mount and cleanup runs on unmount

  // NEW Effect to manage new device notification based on discoveredDevices and devices states
  useEffect(() => {
    // Only proceed if discoveredDevices has data and devices data has been fetched (can be empty array)
    if (discoveredDevices.length > 0 && devices.length >= 0) {
      const registeredIPs = new Set(devices.map((d) => d.ip));

      // Filter discovered devices to find those NOT in the registered list
      const trulyNew = discoveredDevices.filter((d) => d && d.ip && !registeredIPs.has(d.ip));

      if (trulyNew.length > 0) {
        setNewDeviceNotification({
          devices: trulyNew,
          count: trulyNew.length
        });
      } else {
        setNewDeviceNotification(null); // Hide notification if no new devices
      }
    } else {
       setNewDeviceNotification(null); // Hide notification if no discovered devices or devices data not ready
    }
  }, [discoveredDevices, devices]); // <-- This effect runs whenever either of these states change


  // --- Conditional Rendering: Loading State ---
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900 text-white">
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <div className="text-xl">Загрузка устройств...</div>
      </div>
    </div>
  );

  // --- Conditional Rendering: Error State ---
  if (isError) return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900">
      <div className="p-8 text-center bg-zinc-800 rounded-lg border border-red-500 shadow-lg max-w-md mx-auto">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <div className="text-red-400 text-xl font-bold mb-2">Ошибка загрузки устройств!</div>
        <div className="text-gray-300 mb-4">
            Не удалось получить список устройств с сервера. Проверьте соединение и попробуйте обновить страницу.
            <br />
            <span className="text-sm text-gray-400">({fetchError?.message || 'Нет деталей'})</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors"
        >
          Обновить
        </button>
      </div>
    </div>
  );

  // --- Main Component Render ---
  return (
    <div className="p-4 md:p-8 bg-zinc-900 min-h-screen text-white">
        {/* New Device Notification Popup */}
        {newDeviceNotification && (
            <div className="fixed top-4 right-4 z-50 bg-blue-900 text-white p-4 rounded-lg shadow-lg border border-blue-700 max-w-sm w-full">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Обнаружены новые устройства ({newDeviceNotification.count})</h3>
                <button onClick={() => setNewDeviceNotification(null)} className="text-blue-300 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                </button>
            </div>
            <div className="max-h-60 overflow-y-auto pr-2">
                {newDeviceNotification.devices.map((device, index) => (
                <div key={index} className="mb-2 p-3 bg-blue-800 rounded flex justify-between items-center gap-2">
                    <div className="flex-grow overflow-hidden">
                    <div className="font-semibold text-sm truncate">{device.hostname || "Неизвестное устройство"}</div>
                    <div className="text-xs text-blue-300">IP: {device.ip}</div>
                    <div className="text-xs text-blue-300">MAC: {device.mac}</div>
                    </div>
                    {/* Button to add the discovered device */}
                    <button
                    onClick={() => handleAddDiscoveredDevice(device)}
                    disabled={addDeviceMutation.isLoading && addDeviceMutation.variables?.ip === device.ip}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                    Добавить
                    </button>
                </div>
                ))}
            </div>
            </div>
        )}

        {/* Page Title */}
        <h1 className="text-3xl font-bold mb-6 text-white flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-3 text-blue-400">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          Панель управления IoT
        </h1>

        {/* Control Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
             {/* Enable Shield Button */}
            <div className="bg-gradient-to-br from-zinc-800 to-zinc-700 p-4 rounded-lg shadow-md border border-zinc-600 hover:shadow-green-500/30 transition-all duration-300">
            <button
                onClick={() => handleShieldToggle(true)}
                disabled={toggleShieldMutation.isLoading}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-semibold flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Включить защиту
            </button>
            </div>

            {/* Disable Shield Button */}
            <div className="bg-gradient-to-br from-zinc-800 to-zinc-700 p-4 rounded-lg shadow-md border border-zinc-600 hover:shadow-red-500/30 transition-all duration-300">
            <button
                onClick={() => handleShieldToggle(false)}
                disabled={toggleShieldMutation.isLoading}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-white font-semibold flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-8 3v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                Выключить защиту
            </button>
            </div>

            {/* Scan Network Button */}
            <div className="bg-gradient-to-br from-zinc-800 to-zinc-700 p-4 rounded-lg shadow-md border border-zinc-600 hover:shadow-blue-500/30 transition-all duration-300">
            <button
                onClick={handleDiscoverDevices}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-semibold flex items-center justify-center transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                Сканировать сеть
            </button>
            </div>
        </div>

        {/* Secondary Controls: Auto-Block and DDoS */}
        <div className="mb-8 flex flex-wrap gap-4 items-center bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-md">
             {/* Auto-Block Toggle Button */}
            <button
            onClick={() => setAutoBlockEnabled(!autoBlockEnabled)}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center transition-colors duration-300 ${
                autoBlockEnabled
                ? 'bg-yellow-600 hover:bg-yellow-500 text-black'
                : 'bg-zinc-600 hover:bg-zinc-500 text-white'
            }`}
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
            </svg>
            {autoBlockEnabled ? "Авто-блок ВКЛ" : "Авто-блок ВЫКЛ"}
            </button>

            {/* Auto-Block Threshold Input (Conditional) */}
            {autoBlockEnabled && (
            <div className="flex items-center bg-zinc-700 px-3 py-1 rounded-lg">
                <label htmlFor="autoblock-threshold" className="text-white mr-2 text-sm whitespace-nowrap">Порог:</label>
                <input
                id="autoblock-threshold"
                type="number"
                value={autoBlockThreshold}
                onChange={(e) => setAutoBlockThreshold(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 bg-zinc-600 border border-zinc-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                min={1}
                max={100}
                />
            </div>
            )}

            {/* DDoS Attack Toggle Button */}
            <button
            onClick={handleStartDDoS}
            className={`ml-auto px-4 py-2 rounded-lg text-white font-semibold flex items-center transition-colors duration-300 ${
              isAttacking
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-purple-600 hover:bg-purple-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            {isAttacking ? 'Остановить атаку' : 'Начать DDoS'}
          </button>
        </div>

        {/* Widget Container Area */}
        <div className="mb-8">
           <WidgetContainer
            widgets={localWidgets}
            onAddWidget={handleAddWidget}
            onRemoveWidget={handleRemoveWidget}
            reload={() => queryClient.invalidateQueries(['widgets'])}
            />
        </div>

        {/* Add Device Form Section */}
        <div className="mb-8 bg-zinc-800 p-6 rounded-lg shadow-md border border-zinc-700">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-blue-400"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                Добавить устройство вручную
            </h2>
            <form onSubmit={handleAddDevice} className="flex flex-col md:flex-row flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
                <label htmlFor="deviceName" className="block text-sm font-medium text-gray-300 mb-1">Имя</label>
                <input
                    id="deviceName"
                    type="text"
                    placeholder="Например, Камера №1"
                    value={newDevice.name}
                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
            </div>
            <div className="flex-1 min-w-[150px]">
                <label htmlFor="deviceIp" className="block text-sm font-medium text-gray-300 mb-1">IP адрес</label>
                <input
                    id="deviceIp"
                    type="text"
                    placeholder="192.168.1.100"
                    value={newDevice.ip}
                    onChange={(e) => setNewDevice({ ...newDevice, ip: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    pattern="\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"
                />
            </div>
            <div className="flex-1 min-w-[180px]">
                <label htmlFor="deviceMac" className="block text-sm font-medium text-gray-300 mb-1">MAC адрес</label>
                <input
                    id="deviceMac"
                    type="text"
                    placeholder="AA:BB:CC:DD:EE:FF"
                    value={newDevice.mac}
                    onChange={(e) => setNewDevice({ ...newDevice, mac: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                    maxLength={17}
                />
            </div>
            <button
                type="submit"
                disabled={addDeviceMutation.isLoading}
                className="px-5 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white font-semibold flex items-center whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-4 md:mt-0"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                {addDeviceMutation.isLoading ? 'Добавление...' : 'Добавить'}
            </button>
            </form>
            {addDeviceMutation.isError && (
                <p className="text-red-400 text-sm mt-2">Ошибка добавления: {addDeviceMutation.error.response?.data?.detail || addDeviceMutation.error.message || 'Проверьте введенные данные'}</p>
            )}
        </div>

        {/* Registered Device List Section */}
        <div className="mb-8 bg-zinc-800 p-4 rounded-lg shadow-md border border-zinc-700 overflow-x-auto">
           <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-blue-400"><path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"></path><rect x="3" y="4" width="18" height="12" rx="2"></rect><circle cx="12" cy="10" r="2"></circle><line x1="12" y1="16" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line></svg>
            Зарегистрированные устройства
            </h2>
            {devices.length === 0 ? (
            <div className="text-center text-gray-400 py-4">Нет зарегистрированных устройств.</div>
            ) : (
            <table className="min-w-full divide-y divide-zinc-700">
                <thead className="bg-zinc-700/50">
                <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Имя</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">IP</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">MAC</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Статус</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Действия</th>
                </tr>
                </thead>
                <tbody className="bg-zinc-800 divide-y divide-zinc-700">
                {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-700/60 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{d.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{d.ip}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{d.mac}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            d.is_online
                            ? "bg-green-800 text-green-100"
                            : "bg-red-800 text-red-100"
                        }`}>
                        {d.is_online ? "Online" : "Offline"}
                        </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button
                        onClick={() => handleDeleteDevice(d.id)}
                        disabled={deleteDeviceMutation.isLoading && deleteDeviceMutation.variables === d.id}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded-md text-white text-xs font-semibold flex items-center justify-center ml-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Удалить
                        </button>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            )}
        </div>

        {/* Discovered Devices List Section */}
        {discoveredDevices.length > 0 && (
             <div className="mb-8 bg-zinc-800 p-4 rounded-lg shadow-md border border-zinc-700 overflow-x-auto">
                <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-blue-400"><path d="M10.68 13.31a16 16 0 0 0 3.41 0"></path><path d="M6.58 17.41a16 16 0 0 0 10.83 0"></path><path d="M2 12h.01"></path><path d="M21.99 12h.01"></path><path d="M12 2a8 8 0 0 0-8 8"></path><path d="M20 10a8 8 0 0 0-8-8"></path><path d="M12 22a8 8 0 0 0 8-8"></path><path d="M4 14a8 8 0 0 0 8 8"></path><circle cx="12" cy="12" r="2"></circle></svg>
                    Обнаруженные в сети устройства
                </h2>
                <table className="min-w-full divide-y divide-zinc-700">
                    <thead className="bg-zinc-700/50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">IP</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">MAC</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Hostname</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Статус</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Действие</th>
                    </tr>
                    </thead>
                    <tbody className="bg-zinc-800 divide-y divide-zinc-700">
                    {discoveredDevices.map((d, i) => {
                        // Check if this device is already registered by IP
                        const isRegistered = devices.some(regDev => regDev.ip === d.ip);
                        return (
                        <tr key={`${d.ip}-${i}`} className="hover:bg-zinc-700/60 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{d.ip}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{d.mac}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 truncate max-w-[150px]">{d.hostname || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                d.is_alive
                                ? "bg-green-800 text-green-100"
                                : "bg-gray-700 text-gray-200"
                            }`}>
                                {d.is_alive ? "Reachable" : "Unknown"}
                            </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            {!isRegistered ? (
                                <button
                                onClick={() => handleAddDiscoveredDevice(d)}
                                disabled={addDeviceMutation.isLoading && addDeviceMutation.variables?.ip === d.ip}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-md text-white text-xs font-semibold flex items-center justify-center ml-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Добавить
                                </button>
                            ) : (
                                <span className="text-xs text-gray-500 italic ml-auto">Уже добавлен</span>
                            )}
                            </td>
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
             </div>
        )}

        {/* Attack Logs Section */}
        {attackLogs.length > 0 && (
            <div className="mb-8 bg-zinc-800 p-4 rounded-lg shadow-md border border-zinc-700">
               <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-red-400"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Логи DDoS-атаки
                </h2>
                <ul className="text-xs font-mono space-y-1 max-h-60 overflow-y-auto pr-2">
                    {attackLogs.map((log, i) => (
                    <li key={i} className={`border-b border-zinc-700/50 py-1 flex justify-between items-center gap-4 ${
                        log.ok ? "text-green-400" : "text-red-400"
                    }`}>
                        <span className="whitespace-nowrap">[{log.time}] IP: {log.ip}</span>
                        <span className="truncate text-right">{log.status}</span>
                    </li>
                    ))}
                </ul>
            </div>
        )}

    </div>
  );
}