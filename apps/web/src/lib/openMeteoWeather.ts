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

/**
 * 개발용 — URL `?weather=<키>` 로 날씨를 강제해 비주얼을 검증한다(실제 데이터 무관).
 * 예: `?weather=rain`, `?weather=night`, `?weather=typhoon`. 없거나 unknown 이면 null.
 */
export function parseWeatherOverride(search: string): LiveWeather | null {
  const key = new URLSearchParams(search).get("weather")?.trim().toLowerCase();
  if (!key) return null;
  const P: Record<string, Partial<LiveWeather> & { code: number }> = {
    clear: { code: 0, isDay: true },
    night: { code: 0, isDay: false },
    cloudy: { code: 3 },
    fog: { code: 45 },
    rain: { code: 63 },
    heavyrain: { code: 65 },
    shower: { code: 82 },
    snow: { code: 73 },
    heavysnow: { code: 75 },
    hail: { code: 96 },
    thunder: { code: 95 },
    typhoon: { code: 82, windKmh: 55 },
    blizzard: { code: 75, windKmh: 45 },
    rainynight: { code: 63, isDay: false },
  };
  const preset = P[key];
  if (!preset) return null;
  return {
    tempC: preset.tempC ?? 14,
    code: preset.code,
    isDay: preset.isDay ?? true,
    windKmh: preset.windKmh ?? 6,
  };
}

/** 화면 날씨 비주얼 상태 — WMO 코드·바람·밤낮 → 렌더 파라미터로 정규화 */
export type WeatherVisual = {
  night: boolean;
  /** 강수 종류 */
  precip: "none" | "rain" | "snow" | "hail";
  /** 강수 세기 0(없음)~1(폭우/폭설) */
  intensity: number;
  /** 안개·뿌연 대기 */
  fog: boolean;
  /** 번개 섬광(뇌우) */
  thunder: boolean;
  /** 지표 바람 km/h — 파티클 기울기·속도에 반영 */
  windKmh: number;
  /** 극한 표현: 태풍(폭우+강풍) / 눈보라(폭설+강풍) */
  storm: "none" | "typhoon" | "blizzard";
};

/** WMO weather_code + 바람 → 화면 렌더 파라미터. 코어 루프를 해치지 않게 세기는 절제된 범위. */
export function resolveWeatherVisual(w: LiveWeather): WeatherVisual {
  const c = w.code;
  const wind = w.windKmh;
  let precip: WeatherVisual["precip"] = "none";
  let intensity = 0;
  let thunder = false;
  const fog = c === 45 || c === 48;

  if (c >= 95) {
    // 뇌우(95) / 뇌우+우박(96,99)
    thunder = true;
    if (c === 96 || c === 99) {
      precip = "hail";
      intensity = 0.85;
    } else {
      precip = "rain";
      intensity = 0.9;
    }
  } else if ((c >= 71 && c <= 77) || c === 85 || c === 86) {
    precip = "snow";
    intensity = c === 75 || c === 86 ? 0.9 : c === 73 || c === 85 ? 0.6 : 0.35;
  } else if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) {
    precip = "rain";
    // 이슬비(51..) 약 → 강우(65)·소나기(82) 강
    intensity =
      c === 65 || c === 67 || c === 82 ? 0.9 : c === 63 || c === 81 ? 0.6 : 0.3;
  }

  let storm: WeatherVisual["storm"] = "none";
  if (precip === "snow" && intensity >= 0.6 && wind >= 30) storm = "blizzard";
  else if ((precip === "rain" || precip === "hail" || thunder) && intensity >= 0.6 && wind >= 40)
    storm = "typhoon";

  return { night: !w.isDay, precip, intensity, fog, thunder, windKmh: wind, storm };
}

/** HUD 한 줄: 「🌧️ 비 14° · 현지 밤」 */
export function formatLiveWeatherHudLine(w: LiveWeather): string {
  const { icon, label } = weatherGlyph(w.code, w.isDay);
  const temp = `${Math.round(w.tempC)}°`;
  const dayNight = w.isDay ? "현지 낮" : "현지 밤";
  const wind = w.windKmh >= 20 ? ` · 바람 ${Math.round(w.windKmh)}km/h` : "";
  return `${icon} ${label ? `${label} ` : ""}${temp} · ${dayNight}${wind}`;
}
