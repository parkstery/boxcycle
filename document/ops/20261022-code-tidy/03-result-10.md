# 지시10 결과 — P6 디버그 화면을 운영 기본 청크에서 분리

2026-10-22 · 담당 opencode MiniMax M3.1 Flash · 지시 [02-task-10.md](02-task-10.md) · 감리 Claude

## 1. 요약

- `apps/web/src/App.tsx` — `DebugMapStage` 정적 import → `React.lazy` 동적 import. 렌더 자리는 `<Suspense fallback={null}>` 로 감쌌다. 렌더 조건(`debugMapIsolationActive`)·props 는 그대로.
- `apps/web/src/features/map-overlays/AppMapStage.tsx` — `ActivityWorldLodDebugPanel` 정적 import → `React.lazy` 동적 import + `<Suspense fallback={null}>`. `useAppMapOverlays.ts` 의 `import type` 은 그대로 뒀다.
- 지시 밖 파일 1개를 1줄 손댔다: `features/map-overlays/index.ts` 의 **죽은 재-export 1줄 삭제** (§3). 이 줄이 남아 있으면 `ActivityWorldLodDebugPanel` 이 동적 import 로 청크 분리가 되지 않는다.
- 결과: `DebugMapStage-*.js`·`ActivityWorldLodDebugPanel-*.js` 두 지연 청크가 생겼고, 두 디버그 화면 코드는 운영 기본 청크에서 빠졌다.

## 2. 바꾼 줄

### 2-1. `apps/web/src/App.tsx` (3곳)

**① react import 에 `lazy`·`Suspense` 추가 (1행)**

```diff
-import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
+import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
```

**② 정적 import 삭제 (1행) + 모듈 최상단 `lazy` 상수 추가 (+10행, import 블록 끝)**

```diff
-import { DebugMapStage } from "./features/map-overlays/DebugMapStage";
```
```tsx
/**
 * WO-260528 디버그 지도 스테이지 — 주소 스위치(map debug phase A/B/C)로 켜질 때만 불러온다.
 * 정적 import 를 쓰면 운영 기본 청크에 debug 화면이 함께 들어간다 → 동적 import 로 분리.
 */
const DebugMapStage = lazy(() =>
  import(/* webpackChunkName: "debug-map-stage" */ "./features/map-overlays/DebugMapStage").then((m) => ({
    default: m.DebugMapStage,
  })),
);
```

**③ 렌더 자리를 `Suspense` 로 감쌈 (App.tsx 3044행, props·조건 무변경 — 들여쓰기만 +2)**

```diff
         {debugMapIsolationActive ? (
-          <DebugMapStage
+          <Suspense fallback={null}>
+            <DebugMapStage
             ...
-          </DebugMapStage>
+            </DebugMapStage>
+          </Suspense>
         ) : (
```

### 2-2. `apps/web/src/features/map-overlays/AppMapStage.tsx` (2곳)

**① import 분리와 `lazy` 상수 (+9행 / −4행)**

```diff
-import type { ReactNode } from "react";
+import { lazy, Suspense, type ReactNode } from "react";
 import { MapView, type MapViewProps } from "../../components/map/MapView";
 import { MapHud, type MapHudProps } from "../../components/maphud/MapHud";
-import {
-  ActivityWorldLodDebugPanel,
-  type ActivityWorldLodDebugPanelProps,
-} from "./ActivityWorldLodDebugPanel";
+import type { ActivityWorldLodDebugPanelProps } from "./ActivityWorldLodDebugPanel";
+
+/**
+ * LOD debug 패널은 주소 스위치로 켜질 때만 쓰는 화면 — 운영 기본 청크에서 빼고 동적으로 불러온다.
+ */
+const ActivityWorldLodDebugPanel = lazy(() =>
+  import(/* webpackChunkName: "activity-world-lod-debug-panel" */ "./ActivityWorldLodDebugPanel").then((m) => ({
+    default: m.ActivityWorldLodDebugPanel,
+  })),
+);
```

**② 렌더 자리를 `Suspense` 로 감쌈 (props 무변경)**

```diff
-      {lodDebug ? <ActivityWorldLodDebugPanel {...lodDebug} /> : null}
+      {lodDebug ? (
+        <Suspense fallback={null}>
+          <ActivityWorldLodDebugPanel {...lodDebug} />
+        </Suspense>
+      ) : null}
```

`useAppMapOverlays.ts` 는 `import type { ActivityWorldLodDebugPanelProps }` 그대로 — 손대지 않았다.

## 3. 범위 밖 변경 1건 (감리 확인 요망)

**`apps/web/src/features/map-overlays/index.ts` — 죽은 재-export 1줄 삭제**

```diff
-export { ActivityWorldLodDebugPanel } from "./ActivityWorldLodDebugPanel";
```

사유:

1. 이 배럴 재-export 덕분에 `ActivityWorldLodDebugPanel.tsx` 가 진입점에서 **정적으로** 도달 가능해졌다. 그래서 `AppMapStage.tsx` 를 lazy 로 바꿔도 빌드가 경고했다:
   `[INEFFECTIVE_DYNAMIC_IMPORT] src/features/map-overlays/ActivityWorldLodDebugPanel.tsx is dynamically imported by src/features/map-overlays/AppMapStage.tsx but also statically imported by src/features/map-overlays/index.ts, dynamic import will not move module into another chunk.`
   → `ActivityWorldLodDebugPanel-*.js` 청크가 **아예 생기지 않고** 패널 코드가 운영 청크에 남았다. 지시 2번의 완료 조건(별도 청크)에 도달하려면 이 줄이 걸려 있다.
2. 이 재-export 는 **아무도 쓰지 않는다.** 배럴(`features/map-overlays`)을 쓰는 파일은 `App.tsx` 하나뿐이고(`import { AppMapStage, RouteMinimap, useAppMapOverlays } from "./features/map-overlays";`), 거기서 `ActivityWorldLodDebugPanel` 을 꺼내 쓰지 않는다. 저장소 전체 grep(테스트·스크립트 포함)에서도 이 이름은 `index.ts` 자기 자신과 `useAppMapOverlays.ts` 의 **타입** import 뿐이다.
3. 동작 변화 없음 — 죽은 export 제거일 뿐이다. `index.ts` 의 나머지 export 는 그대로다.

감리 판단으로 되돌리길 원하면 `index.ts` 한 줄을 되돌리면 되고, 그러면 `ActivityWorldLodDebugPanel` 이 운영 청크에 남는다(위의 경고대로).

## 4. 새 청크 (운영 기본 청크에서 빠진 것)

`apps/web/dist/assets` (루트 `npm run build` 결과):

| 새 청크 | 크기 | gzip | 언제 읽나 |
|---|---|---|---|
| `DebugMapStage-C3xSPL2F.js` | 5.22 kB | 2.16 kB | `VITE_MAP_DEBUG_PHASE=A\|B\|C` 로 켤 때만 |
| `ActivityWorldLodDebugPanel-BuZ7mRMF.js` | 1.52 kB | 0.80 kB | LOD debug 패널 props 가 생길 때만 |

두 청크 모두 **지연 로드**(index.html 의 modulepreload 에 없음)다.

청크 분리 검증(빌드 산출물 문자열 검사):

| 문자열 | index-C_-dX51H.js | camera1Mode-jFFOGYcr.js | DebugMapStage 청크 | ActivityWorldLodDebugPanel 청크 |
|---|---|---|---|---|
| `debug-world-light-src` (DebugWorldLightMap 소스 id) | 없음 | 없음 | **있음** | – |
| `activity-world-lod-debug` (패널 클래스) | 없음 | 없음 | – | **있음** |
| `Phase D (catalog)` (패널 문자열) | 없음 | 없음 | – | **있음** |

> 기본 청크에 `debug-world-light-circle` 문자열이 하나 남지만, 그건 화면이 아니라 `apps/web/src/lib/map/layerOrder.ts` 의 레이어 순서표 항목이다(범위 밖 — 손대지 않음).

## 5. 기본 청크 크기 전후

기준선: 이 작업 시작 직전(HEAD `c437bc94`, 다른 묶음 P1·P3 반영 상태) 빌드.

| 항목 | 전 | 후 | 차이 |
|---|---|---|---|
| **기본 청크 `index-*.js`** | `index-LUsWKtny.js` **3,737.12 kB** (gzip 1,053.94 kB) | `index-C_-dX51H.js` **1,981.78 kB** (gzip 575.71 kB) | **−1,755.34 kB (−47.0%)** / gzip −478.23 kB |
| 첫 화면 eager JS 합계 | 3,745.56 kB (index 3,737.12 + jsx-runtime 8.44) | 3,739.17 kB (index 1,981.78 + camera1Mode 1,748.90 + jsx-runtime 0.97 + react 7.52) | −6.39 kB |
| dist 전체 JS 합계 | 3,778.33 kB | 3,778.82 kB | +0.49 kB (청크 분할 오버헤드) |

**주의 (감리가 알아야 할 사실)**: 기본 청크가 1.75 MB 줄었지만 그 대부분은 `DebugMapStage` 가 공유하는 mapbox·three 계통이 **새 공유 청크 `camera1Mode-jFFOGYcr.js` (1,748.90 kB, gzip 476.51 kB)** 로 옮겨간 것이고, 이 청크는 `index.html` 의 `modulepreload` 에 들어 있어 **여전히 첫 화면에 같이 내려받는다.** 그래서:

- 「운영 기본 청크에서 디버그 화면 코드가 빠졌다」는 목표는 달성(디버그 화면 2종 + DebugWorldLightMap 본문이 eager 경로에서 빠짐).
- 그러나 **첫 화면 실다운로드 총량은 거의 줄지 않았다(−6.4 kB)**. `DebugWorldLightMap` 가 mapbox-gl 을 통째로 끌어오는 구조라 공유 청크로 옮겨갈 수밖에 없었다. 진짜 첫 화면 감소를 원하면 `DebugWorldLightMap` 의 mapbox 의존 자체를地址 스위치 뒤로 미루는 별도 작업이 필요하다 — 이번 지시 범위 밖.

## 6. 검사 결과

`apps/web` (C:\20.HDev\boxcycle\apps\web)

- `npx tsc -b --noEmit` → 출력 없음, 종료 코드 0.
- `npx eslint src/App.tsx src/features/map-overlays/AppMapStage.tsx src/features/map-overlays/index.ts` → **0 errors, 7 warnings** (전부 기존 `react-hooks/exhaustive-deps` 경고: App.tsx 742·1220·1293·1309·1351·1432·2998행. 손댄 코드와 무관한 기존 경고이며 줄지 않았고 늘지도 않았다).

루트 (C:\20.HDev\boxcycle)

- `npm run build` → 성공. `dist/assets` 에 `DebugMapStage-C3xSPL2F.js`(5.22 kB)·`ActivityWorldLodDebugPanel-BuZ7mRMF.js`(1.52 kB) 별도 청크 확인. `INEFFECTIVE_DYNAMIC_IMPORT` 경고 사라짐. 남은 경고는 이전에도 있던 500 kB 초과 청크 안내 1건뿐.
- `npm run test:quick` → **합계 통과 1,341 · 실패 0** (ride 843 / route 176 / map 151 / peer 72 / meters 58 / tools 41 · 60.7초). 미실행 시험 없음.

**마지막 줄**: `npx tsc -b --noEmit` 종료 코드 0 · `npx eslint` 0 errors 7 warnings(기존) · `npm run build` 성공 + 새 청크 2개 확인 · `npm run test:quick` 통과 1,341 / 실패 0.

## 7. 하지 않은 것

- `lib/debug/*` 계측 함수(走行 중 호출되는 `note…` 등) 이동·삭제 없음.
- 시험·설정·baseline 수정 없음. git commit·push·stash·checkout·restore·clean·worktree 전부 미사용(작업 트리 변경은 위 3개 파일뿐).
- `dev-tools.json` 등록 추가 없음 — 새 디버그 코드·주소 스위치·스크립트를 만들지 않았다. 쓰는 주소 스위치 `mapDebugPhase`(`VITE_MAP_DEBUG_PHASE`, `class: permanent`)는 이미 등록돼 있고, 그 화면 2종을 동적 import 로 나눈 것이 이번 작업이다.
- e2e(Playwright)는 실행하지 않았다 — 변경이 지연 로드 분할뿐이고 라우팅·셀렉터 계약은 건드리지 않았다. 감리 검증에서 필요하면 추가 요청.

## 8. Chief 확인 방법

- 실행 폴더(절대 경로): `C:\20.HDev\boxcycle` (루트) · `C:\20.HDev\boxcycle\apps\web` (웹)
- 타입·lint:
  ```
  cd C:\20.HDev\boxcycle\apps\web
  npx tsc -b --noEmit
  npx eslint src/App.tsx src/features/map-overlays/AppMapStage.tsx src/features/map-overlays/index.ts
  ```
- 빌드 + 청크 확인:
  ```
  cd C:\20.HDev\boxcycle
  npm run build
  dir C:\20.HDev\boxcycle\apps\web\dist\assets
  ```
  → `DebugMapStage-*.js` · `ActivityWorldLodDebugPanel-*.js` 가 있고, `index-*.js` 가 약 1.98 MB 로 줄었다.
- 화면 확인(디버그 화면이 켜지는 쪽):
  ```
  cd C:\20.HDev\boxcycle
  set VITE_MAP_DEBUG_PHASE=A
  npm run dev
  ```
  → PC 브라우저로 `http://localhost:5000` 접속(폰이면 `http://<PC의 LAN IP>:5000`). `?` 로 Phase A(B/C) 상태를 본다. 스위치를 끄면(환경변수 없음) `DebugMapStage` 청크는 요청되지 않는다 → 네트워크 탭에서 `DebugMapStage-*.js` 미로드 확인.
- 회귀 확인(선택): `cd C:\20.HDev\boxcycle && npm run test:quick`
