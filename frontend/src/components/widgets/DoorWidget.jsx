// src/components/widgets/DoorWidget.jsx
import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';

/* ───────────────── helpers ───────────────── */
const tgSend = async (token, chat, text) => {
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ chat_id: chat, text }),
    });
  } catch (e) {
    console.error('Telegram send failed:', e);
  }
};

/* ───────────────── component ──────────────── */
export default function DoorWidget({ widget, reload = () => {}, remove = () => {} }) {
  const cfg            = widget.config ?? {};
  const tgToken        = cfg.telegramToken?.trim();
  const tgChat         = cfg.telegramChatId?.trim();
  const wrongLimit     = cfg.wrongPassAttemptsThreshold ?? 3;

  /* current state coming from backend */
  const [isOpen, setOpen] = useState(Boolean(cfg.is_open));
  const [autoLock, setAutoLock] = useState(cfg.autoLockTime ?? '00:00');

  /* local UI state */
  const [pwdPrompt, setPwdPrompt] = useState(false);
  const [pwdInput , setPwdInput ] = useState('');
  const [busy     , setBusy     ] = useState(false);
  const [cfgPwd   , setCfgPwd   ] = useState('');               // for config field
  const [cfgWrong , setCfgWrong ] = useState(cfg.wrongPassAttemptsThreshold ?? 3);
  const wrongCnt = useRef(cfg.wrongPassAttempts ?? 0);
  const timerId  = useRef(null);

  /* keep open flag in sync when parent refreshes */
  useEffect(() => {
    setOpen(Boolean(widget.config?.is_open));
  }, [widget.config?.is_open]);

  /* (re)create auto‑lock timer */
  useEffect(() => {
    if (timerId.current) clearTimeout(timerId.current);
    if (!isOpen || !autoLock || autoLock === '00:00') return;

    const [h, m] = autoLock.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);    // tomorrow
    const delay = target - now;

    timerId.current = setTimeout(() => handleToggle(true), delay);   // force close
    return () => clearTimeout(timerId.current);
  }, [isOpen, autoLock]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ─────────── backend helpers ─────────── */
  const sendConfigure = async (obj) => {
    await api.post(`/widgets/${widget.id}/configure/`, obj);
    reload();
  };

  const handleToggle = async (forceClose = false, pwd = null) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/widgets/${widget.id}/toggle/`,
                     forceClose ? { forceClose: true }
                                : (pwd ? { password: pwd } : {}));
      wrongCnt.current = 0;
      setOpen(o => !o);
      reload();
    } catch (e) {
      const code = e?.response?.status;
      const msg  = e?.response?.data?.error || 'Ошибка';
      if (code === 403 || code === 400) {
        wrongCnt.current += 1;
        alert(msg);
        if (wrongCnt.current >= wrongLimit) {
          tgSend(tgToken, tgChat,
            `🚨 ${wrongCnt.current} неверных паролей у замка «${widget.title}»`);
          wrongCnt.current = 0;
        }
      } else {
        alert(msg);
      }
    } finally {
      setBusy(false);
      setPwdInput('');
      setPwdPrompt(false);
    }
  };

  /* ─────────── ui handlers ─────────── */
  const mainBtnClick = () => {
    if (isOpen) return handleToggle();    // closing
    setPwdPrompt(true);                   // ask password
  };

  const savePassword = () => {
    sendConfigure({ password: cfgPwd.trim() });
    setCfgPwd('');
  };

  const saveWrongLimit = () => {
    const v = Math.max(1, Number(cfgWrong) || 3);
    sendConfigure({ wrongPassAttemptsThreshold: v });
  };

  const saveAutoLock = (value) => {
    setAutoLock(value);
    sendConfigure({ autoLockTime: value });
  };

  /* ─────────── render ─────────── */
  return (
    <div className="bg-zinc-800 p-4 rounded relative">
      {/* remove */}
      <button onClick={remove}
              className="absolute top-2 right-2 text-zinc-500 hover:text-red-500">×</button>

      <h3 className="text-white mb-4">🚪 {widget.title}</h3>

      {/* open / close */}
      <button onClick={mainBtnClick}
              disabled={busy}
              className={`w-full px-4 py-2 mb-4 rounded text-white transition-colors
                ${isOpen ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-green-600 hover:bg-green-700'}`}>
        {busy ? '…' : (isOpen ? 'Закрыть' : 'Открыть')}
      </button>

      {/* configuration block */}
      <div className="space-y-3 text-sm text-white">
        {/* auto‑lock */}
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap">Авто‑закрытие в&nbsp;</label>
          <input type="time"
                 value={autoLock}
                 onChange={e => saveAutoLock(e.target.value)}
                 className="bg-zinc-700 rounded px-2 py-1"/>
        </div>

        {/* set password */}
        <div className="flex items-center gap-2">
          <label>Пароль</label>
          <input type="password"
                 value={cfgPwd}
                 onChange={e => setCfgPwd(e.target.value)}
                 className="bg-zinc-700 rounded px-2 py-1 flex-1"/>
          <button onClick={savePassword}
                  disabled={!cfgPwd.trim()}
                  className="px-2 py-1 bg-green-600 rounded disabled:opacity-40">Сохранить</button>
        </div>

        {/* wrong attempts threshold */}
        <div className="flex items-center gap-2">
          <label>Max попыток</label>
          <input type="number"
                 min={1}
                 value={cfgWrong}
                 onChange={e => setCfgWrong(e.target.value)}
                 className="bg-zinc-700 rounded px-2 py-1 w-20 text-center"/>
          <button onClick={saveWrongLimit}
                  className="px-2 py-1 bg-green-600 rounded">OK</button>
        </div>
      </div>

      {/* pwd prompt */}
      {pwdPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={e => {e.preventDefault(); handleToggle(false, pwdInput);}}
                className="bg-zinc-800 p-6 rounded-lg shadow-xl">
            <h4 className="text-lg text-white mb-4">Введите пароль</h4>
            <input type="password"
                   value={pwdInput}
                   onChange={e => setPwdInput(e.target.value)}
                   className="w-full bg-zinc-700 rounded px-2 py-1 mb-4"
                   autoFocus />
            <div className="flex justify-end gap-2">
              <button type="button"
                      onClick={() => { setPwdPrompt(false); setPwdInput(''); }}
                      className="px-4 py-2 bg-zinc-600 rounded text-white">Отмена</button>
              <button type="submit"
                      className="px-4 py-2 bg-blue-600 rounded text-white"
                      disabled={!pwdInput.trim()}>OK</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
