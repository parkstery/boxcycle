import type { LngLat } from "./geo";

/**
 * Open-Meteo 현재 기상 — 「라이브 어스」 리얼리즘(Conquest 설계 §7 Phase C 선행 도입).
 * 주행 지역의 실제 지금 날씨·밤낮을 HUD 한 줄로 보여준다. 키 불필요·무료.
 */
export type LiveWeather = {
  tempC: number;
  /** WMO weather code */
  code: number;
  isDay: boolean;
  windKmh: number;
};

export async function fetchOpenMeteoCurrentWeather(
  lngLat: LngLat,
  signal?: AbortSignal,
): Promise<LiveWeather | null> {
  const [lng, lat] = lngLat;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,weather_code,is_day,wind_speed_10m&wind_speed_unit=kmh&timezone=auto`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
        wind_speed_10m?: number;
      };
    };
    const cur = json.current;
    if (!cur || typeof cur.temperature_2m !== "number") return null;
    return {
      tempC: cur.temperature_2m,
      code: typeof cur.weather_code === "number" ? cur.weather_code : 0,
      isDay: cur.is_day === 1,
      windKmh: typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : 0,
    };
  } catch {
    return null;
  }
}

/** WMO weather code → 이모지 + 짧은 한국어 */
function weatherGlyph(code: number, isDay: boolean): { icon: string; label: string } {
  if (code === 0) return isDay ? { icon: "☀️", label: "맑음" } : { icon: "🌙", label: "맑은 밤" };
  if (code === 1 || code === 2) return isDay ? { icon: "🌤️", label: "구름 조금" } : { icon: "🌙", label: "구름 조금" };
  if (code === 3) return { icon: "☁️", label: "흐림" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "안개" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "🌧️", label: "비" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: "🌨️", label: "눈" };
  if (code >= 95) return { icon: "⛈️", label: "뇌우" };
  return { icon: "🌡️", label: "" };
}

/** HUD 한 줄: 「🌧️ 비 14° · 현지 밤」 */
export function formatLiveWeatherHudLine(w: LiveWeather): string {
  const { icon, label } = weatherGlyph(w.code, w.isDay);
  const temp = `${Math.round(w.tempC)}°`;
  const dayNight = w.isDay ? "현지 낮" : "현지 밤";
  const wind = w.windKmh >= 20 ? ` · 바람 ${Math.round(w.windKmh)}km/h` : "";
  return `${icon} ${label ? `${label} ` : ""}${temp} · ${dayNight}${wind}`;
}
