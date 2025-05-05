// src/api/blynkClient.js
const AUTH_TOKEN = "R7vaLoNA4_jATZ80fRG5GW0PLiw-K4V_";
const BASE_URL = `https://sgp1.blynk.cloud/external/api`;

export async function getVirtualPin(pin = 0) {
  const res = await fetch(`${BASE_URL}/get?token=${AUTH_TOKEN}&v${pin}`);
  if (!res.ok) throw new Error("Ошибка получения данных от Blynk");
  return res.text();
}
