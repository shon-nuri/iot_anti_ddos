import { useState, useEffect, useRef } from 'react';
import widgetsApi from '../../api/widgets';

export default function LightWidget({ widget, reload = () => {}, remove = () => {} }) {
  const [cfg, setCfg] = useState(widget.config || {});
  const [autoOff, setOff] = useState(cfg.autoOff || '00:00');
  const timers = useRef({ off: null });

  const handleClick = async () => {
    try {
      const res = await widgetsApi.toggle(widget.id);
      if (res.data && res.data.config) {
        setCfg(res.data.config);
        reload();
      }
    } catch (err) {
      console.error('Toggle failed:', err);
      alert('Ошибка при переключении света');
    }
  };

  useEffect(() => {
    clearTimeout(timers.current.off);

    if (cfg.is_on && autoOff && autoOff !== '00:00') {
      const [h, m] = autoOff.split(':').map(Number);
      const now = new Date();
      const target = new Date(now);
      target.setHours(h, m, 0, 0);

      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      timers.current.off = setTimeout(async () => {
        if (cfg.is_on) await handleClick();
      }, target - now);

      return () => clearTimeout(timers.current.off);
    }
  }, [autoOff, cfg.is_on]);

  return (
    <div className="bg-zinc-800 p-4 rounded relative">
      <button onClick={remove} 
              className="absolute top-2 right-2 text-zinc-500 hover:text-red-500">×</button>

      <h3 className="text-white mb-2">{widget.title}</h3>

      <button onClick={handleClick}
                className={`px-3 py-1 rounded text-black mb-4 transition-colors ${
                cfg.is_on 
                    ? 'bg-yellow-500 hover:bg-yellow-400' 
                    : 'bg-zinc-400 hover:bg-zinc-300'
                }`}>
        {cfg.is_on ? '💡 On' : '💡 Off'}
        </button>

      <div className="space-x-2 text-sm text-white">
        <label>Авто-выкл:</label>
        <input type="time" 
               value={autoOff}
               onChange={e => {
                 const v = e.target.value;
                 setOff(v);
                 widgetsApi.update(widget.id, { 
                   config: { ...cfg, autoOff: v }
                 });
               }}
               className="bg-zinc-700 rounded px-1"/>
      </div>
    </div>
  );
}