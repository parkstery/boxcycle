import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

/** 지도 타일용 pk. — Directions 와 무관. 기존 .env.local 을 읽기만 하고 덮어쓰지 않는다. */
export function readMapboxPkForUiSmoke() {
  if (process.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()) {
    return process.env.VITE_MAPBOX_ACCESS_TOKEN.trim();
  }

  const candidates = [
    path.join(repoRoot, "apps/web/.env.local"),
    path.join(repoRoot, "apps/web/.env"),
    path.join(repoRoot, "../boxcycle/apps/web/.env.local"),
    path.join(repoRoot, "../boxcycle/apps/web/.env"),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const match = text.match(/^\s*VITE_MAPBOX_ACCESS_TOKEN\s*=\s*(.+?)\s*$/m);
    if (!match?.[1]) continue;
    const value = match[1].trim().replace(/^["']|["']$/g, "");
    if (value && !value.startsWith("pk.route-token-harness")) return value;
  }

  throw new Error(
    "UI smoke: VITE_MAPBOX_ACCESS_TOKEN(pk.) 없음 — apps/web/.env.local 또는 환경변수로 설정하세요.",
  );
}
