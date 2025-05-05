# api/emulator.py
import importlib

def handler(request):             # Vercel вызывает эту функцию
    mod = importlib.import_module("backend.emulator")
    mod.main()                    # если в backend/emulator.py функция main()
    return { "ok": True }         # JSON‑ответ
