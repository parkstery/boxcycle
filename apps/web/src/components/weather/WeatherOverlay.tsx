import { useEffect, useRef } from "react";
import type { LiveWeather } from "../../lib/openMeteoWeather";
import { resolveWeatherVisual, type WeatherVisual } from "../../lib/openMeteoWeather";
import "./WeatherOverlay.css";

type Particle = {
  x: number;
  y: number;
  z: number; // 0..1 깊이(원근): 클수록 앞·큼·빠름
  len: number;
  drift: number;
};

/**
 * 주행 지역의 실제 날씨를 지도 위에 은은하게 그린다(밤 틴트·비·눈·우박·안개·번개·태풍·눈보라).
 * pointer-events 없음 — 코어 루프(주행·지도 조작)를 방해하지 않는다. 데이터 없으면 아무것도 안 그림.
 */
export function WeatherOverlay({ weather }: { weather: LiveWeather | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualRef = useRef<WeatherVisual | null>(null);
  visualRef.current = weather ? resolveWeatherVisual(weather) : null;

  const v = visualRef.current;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const particles: Particle[] = [];

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    };
    resize();
    window.addEventListener("resize", resize);
    // 마운트 시점에 레이아웃이 0 으로 잡히는 경우 대비 — 실제 크기 확정되면 재설정.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const ensureCount = (target: number) => {
      while (particles.length < target) {
        particles.push({
          x: Math.random(),
          y: Math.random(),
          z: rand(0.3, 1),
          len: rand(0.5, 1),
          drift: rand(-1, 1),
        });
      }
      if (particles.length > target) particles.length = target;
    };

    const draw = () => {
      if (!running) return;
      const vis = visualRef.current;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (!vis || vis.precip === "none") {
        ensureCount(0);
        raf = requestAnimationFrame(draw);
        return;
      }

      // 바람: km/h → 화면 수평 성분(정규화). 태풍/눈보라는 더 세게 기울인다.
      const windBase = Math.max(-1, Math.min(1, vis.windKmh / 60));
      const stormWind =
        vis.storm === "typhoon" ? 1 : vis.storm === "blizzard" ? 0.85 : 0;
      const wind = Math.abs(windBase) < 0.06 && stormWind === 0 ? 0.06 : windBase + Math.sign(windBase || 1) * stormWind * 0.6;

      // 약한 강수도 확실히 보이도록 세기 바닥을 올린다.
      const power = Math.max(0.4, vis.intensity);

      if (vis.precip === "snow") {
        const target = Math.round(90 + power * 220);
        ensureCount(target);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        for (const p of particles) {
          const speed = (0.0016 + power * 0.003) * (0.5 + p.z);
          p.y += speed;
          p.x += (wind * 0.002 + Math.sin((p.y + p.drift) * 12) * 0.0008) * (0.5 + p.z);
          if (p.y > 1.02) { p.y = -0.02; p.x = Math.random(); }
          if (p.x > 1.02) p.x = -0.02; else if (p.x < -0.02) p.x = 1.02;
          const r = (1.4 + p.z * 2.4) * dpr;
          ctx.globalAlpha = 0.6 + p.z * 0.4;
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // rain / hail — 기울어진 선(우박은 짧고 굵게). 라이트 지도에서도 보이게 진하고 굵게.
        const hail = vis.precip === "hail";
        const target = Math.round((hail ? 70 : 160) + power * (hail ? 120 : 320));
        ensureCount(target);
        ctx.strokeStyle = hail ? "rgba(200,214,230,0.95)" : "rgba(120,150,195,0.85)";
        for (const p of particles) {
          const speed = (hail ? 0.035 : 0.028 + power * 0.03) * (0.5 + p.z);
          p.y += speed;
          p.x += wind * (hail ? 0.004 : 0.012) * (0.5 + p.z);
          if (p.y > 1.02) { p.y = -0.05; p.x = Math.random(); }
          if (p.x > 1.05) p.x = -0.05; else if (p.x < -0.05) p.x = 1.05;
          const segLen = (hail ? 8 : 20 + power * 14) * p.len * (0.5 + p.z) * dpr;
          const wx = wind * (hail ? 6 : 16) * dpr;
          ctx.lineWidth = (hail ? 2.6 : 1.4 + p.z * 1.4) * dpr;
          ctx.globalAlpha = 0.55 + p.z * 0.45;
          ctx.beginPath();
          ctx.moveTo(p.x * W, p.y * H);
          ctx.lineTo(p.x * W + wx, p.y * H + segLen);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro?.disconnect();
    };
  }, []);

  if (!v) return null;

  // 틴트는 독립 레이어(div)로 쌓아 조합(예: 비 오는 밤 = 밤+비)을 모두 표현한다.
  const tints: string[] = [];
  if (v.precip === "rain" || v.precip === "hail") tints.push("weather-tint--rain");
  if (v.precip === "snow") tints.push("weather-tint--snow");
  if (v.storm === "typhoon") tints.push("weather-tint--typhoon");
  if (v.storm === "blizzard") tints.push("weather-tint--blizzard");
  if (v.fog) tints.push("weather-tint--fog");
  if (v.night) tints.push("weather-tint--night");

  return (
    <div className="weather-overlay" aria-hidden>
      {tints.map((t) => (
        <div key={t} className={`weather-tint ${t}`} />
      ))}
      <canvas ref={canvasRef} className="weather-overlay__canvas" />
      {v.thunder ? <div className="weather-overlay__flash" /> : null}
    </div>
  );
}
