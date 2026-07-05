/**
 * 사용자 경로 중복 정리 — 같은 경로(지문)로 여러 번 저장된 문서를 그룹당 1개만 남기고 정리한다.
 *
 * 배경: routeFingerprint 규칙 변경 이전에 저장된 문서는 옛 규칙(좌표열 해시)으로 지문이
 * 박혀 있어 중복 감지 사각지대에 빠져 있었다 → 같은 경로가 수십 건 중복 저장됨.
 * 이 CLI 는 모든 문서를 현재 규칙으로 재계산해 그룹핑하고, 대표 1건만 남긴 뒤
 * 남긴 문서에 새 지문을 백필한다.
 *
 * 대표 선정: completed(완주) 우선 → createdAt 오래된 것 우선(원본 보존).
 * 대표에는 그룹 크기를 saveCount 로 기록한다.
 *
 *   # 미리보기(기본, 아무것도 지우지 않음)
 *   npm run admin:dedupe-saved-routes -- --nickname=a111111
 *   npm run admin:dedupe-saved-routes -- --uid=<uid>
 *   npm run admin:dedupe-saved-routes -- --all           # 전체 사용자
 *   # 실제 삭제
 *   npm run admin:dedupe-saved-routes -- --nickname=a111111 --apply
 */
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import {
  computeRouteFingerprintHex,
  resolveRouteProfile,
  type LngLat,
} from "./routeFingerprintCore.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function resolveUid(nickname: string): Promise<string | null> {
  const db = getFirestore();
  const key = nickname.trim().toLowerCase();
  const nickSnap = await db.doc(`nicknames/${key}`).get();
  const owner = nickSnap.data()?.ownerUid;
  if (typeof owner === "string" && owner) return owner;
  const q = await db.collection("users").where("nickname", "==", nickname.trim()).limit(1).get();
  return q.empty ? null : q.docs[0].id;
}

/** Firestore savedRoutes 문서에서 좌표열을 복원(geometryCoordsJson 우선). */
function decodeCoords(data: Record<string, unknown>): LngLat[] | null {
  const json = data.geometryCoordsJson;
  if (typeof json === "string" && json.length > 0) {
    try {
      const coords = JSON.parse(json) as unknown;
      if (
        Array.isArray(coords) &&
        coords.length >= 2 &&
        coords.every(
          (c) =>
            Array.isArray(c) &&
            c.length === 2 &&
            typeof c[0] === "number" &&
            typeof c[1] === "number" &&
            Number.isFinite(c[0]) &&
            Number.isFinite(c[1]),
        )
      ) {
        return coords as LngLat[];
      }
    } catch {
      /* fallthrough */
    }
  }
  const legacy = data.geometry as { type?: string; coordinates?: unknown } | undefined;
  if (legacy?.type === "LineString" && Array.isArray(legacy.coordinates)) {
    const c = legacy.coordinates as unknown[];
    if (
      c.length >= 2 &&
      c.every(
        (p) =>
          Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number",
      )
    ) {
      return c as LngLat[];
    }
  }
  return null;
}

type RouteRow = {
  id: string;
  fp: string;
  completed: number;
  createdAtMs: number;
};

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  return Number.MAX_SAFE_INTEGER; // createdAt 없는 문서는 "가장 최근"으로 취급 → 대표에서 밀림
}

/** 한 사용자의 중복을 정리. 반환 = { groups, duplicates, deleted } */
async function dedupeUser(
  uid: string,
  apply: boolean,
): Promise<{ total: number; groups: number; duplicates: number; deleted: number }> {
  const db = getFirestore();
  const snap = await db.collection("savedRoutes").where("userId", "==", uid).get();

  const byFp = new Map<string, RouteRow[]>();
  let undecodable = 0;
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const coords = decodeCoords(data);
    if (!coords) {
      undecodable += 1;
      continue;
    }
    const profile = resolveRouteProfile(data.profile);
    const fp = computeRouteFingerprintHex(coords, profile);
    const row: RouteRow = {
      id: d.id,
      fp,
      completed: data.completed === 1 ? 1 : 0,
      createdAtMs: toMillis(data.createdAt),
    };
    const list = byFp.get(fp) ?? [];
    list.push(row);
    byFp.set(fp, list);
  }

  let duplicates = 0;
  let deleted = 0;
  let groupsWithDup = 0;

  for (const [fp, rows] of byFp) {
    if (rows.length <= 1) continue;
    groupsWithDup += 1;
    // 대표: 완주 우선 → 오래된 것 우선
    rows.sort((a, b) =>
      b.completed - a.completed || a.createdAtMs - b.createdAtMs,
    );
    const keep = rows[0];
    const drop = rows.slice(1);
    duplicates += drop.length;

    console.info(
      `  fp ${fp.slice(0, 12)}… : ${rows.length}건 → 유지 ${keep.id.slice(0, 8)}` +
        `(completed=${keep.completed}), 삭제 ${drop.length}건`,
    );

    if (apply) {
      // 대표에 새 지문 백필 + 그룹 크기 기록
      await db.doc(`savedRoutes/${keep.id}`).set(
        {
          routeFingerprint: fp,
          saveCount: rows.length,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      for (const r of drop) {
        await db.doc(`savedRoutes/${r.id}`).delete();
        deleted += 1;
      }
    }
  }

  if (undecodable > 0) {
    console.warn(`  ⚠️ geometry 해독 불가 ${undecodable}건 — 건드리지 않음(수동 확인 필요).`);
  }

  return { total: snap.size, groups: groupsWithDup, duplicates, deleted };
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const apply = flag("apply");
  const all = flag("all");
  const db = getFirestore();

  let uids: string[] = [];
  if (all) {
    // savedRoutes 의 고유 userId 수집
    const snap = await db.collection("savedRoutes").select("userId").get();
    uids = [...new Set(snap.docs.map((d) => String(d.data().userId ?? "")).filter(Boolean))];
  } else {
    let uid = arg("uid")?.trim();
    const nickname = arg("nickname")?.trim();
    if (!uid && nickname) uid = (await resolveUid(nickname)) ?? undefined;
    if (!uid) {
      console.error("필수: --uid=<uid> / --nickname=<닉네임> / --all");
      process.exit(1);
    }
    uids = [uid];
  }

  console.info(
    `[dedupe] 모드=${apply ? "APPLY(실제 삭제)" : "DRY-RUN(미리보기)"} · 대상 사용자 ${uids.length}명\n`,
  );

  let totalDup = 0;
  let totalDel = 0;
  for (const uid of uids) {
    console.info(`■ user ${uid.slice(0, 10)}`);
    const r = await dedupeUser(uid, apply);
    console.info(
      `  전체 ${r.total}건 · 중복그룹 ${r.groups}개 · 잉여 ${r.duplicates}건 · 삭제 ${r.deleted}건\n`,
    );
    totalDup += r.duplicates;
    totalDel += r.deleted;
  }

  console.info(
    `[dedupe] 합계 잉여 ${totalDup}건${apply ? ` · 삭제 ${totalDel}건 완료` : " (DRY-RUN — --apply 로 실제 삭제)"}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
