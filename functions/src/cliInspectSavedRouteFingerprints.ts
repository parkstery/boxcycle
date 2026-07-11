/**
 * 임시 진단 — 한 사용자의 savedRoutes 각 문서의 지문 구성요소(S/E·거리·profile·이름)를 덤프.
 * "화면엔 같아 보이는데 왜 중복으로 안 묶이나" 를 눈으로 확인하는 용도.
 *
 *   npm run build && node lib/cliInspectSavedRouteFingerprints.js --nickname=geum
 */
import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import {
  computeRouteFingerprintHex,
  resolveRouteProfile,
  type LngLat,
} from "./routeFingerprintCore.js";

function arg(name: string): string | undefined {
  const p = `--${name}=`;
  const h = process.argv.find((a) => a.startsWith(p));
  return h ? h.slice(p.length) : undefined;
}
async function resolveUid(nickname: string): Promise<string | null> {
  const db = getFirestore();
  const key = nickname.trim().toLowerCase();
  const s = await db.doc(`nicknames/${key}`).get();
  const owner = s.data()?.ownerUid;
  if (typeof owner === "string" && owner) return owner;
  const q = await db.collection("users").where("nickname", "==", nickname.trim()).limit(1).get();
  return q.empty ? null : q.docs[0].id;
}
function decodeCoords(data: Record<string, unknown>): LngLat[] | null {
  const json = data.geometryCoordsJson;
  if (typeof json === "string" && json.length > 0) {
    try {
      const c = JSON.parse(json) as unknown;
      if (Array.isArray(c) && c.length >= 2) return c as LngLat[];
    } catch {
      /* noop */
    }
  }
  return null;
}
function lineMeters(coords: LngLat[]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let m = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
    m += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return m;
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });
  const db = getFirestore();
  let uid = arg("uid")?.trim();
  const nickname = arg("nickname")?.trim();
  if (!uid && nickname) uid = (await resolveUid(nickname)) ?? undefined;
  if (!uid) {
    console.error("필수: --uid 또는 --nickname");
    process.exit(1);
  }

  const snap = await db.collection("savedRoutes").where("userId", "==", uid).get();
  console.info(`user ${uid} · ${snap.size}건\n`);
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const coords = decodeCoords(data);
    const profile = resolveRouteProfile(data.profile);
    const name = String(data.name ?? "");
    if (!coords) {
      console.info(`  ${d.id.slice(0, 8)} "${name}" — geometry 없음`);
      continue;
    }
    const s = coords[0];
    const e = coords[coords.length - 1];
    const meters = lineMeters(coords);
    const fp = computeRouteFingerprintHex(coords, profile);
    console.info(
      `  ${d.id.slice(0, 8)} "${name}" | pts=${coords.length} | ` +
        `S=${s[0].toFixed(5)},${s[1].toFixed(5)} E=${e[0].toFixed(5)},${e[1].toFixed(5)} | ` +
        `${meters.toFixed(1)}m(bucket ${Math.round(meters / 100)}) | ${profile} | fp ${fp.slice(0, 10)}`,
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
