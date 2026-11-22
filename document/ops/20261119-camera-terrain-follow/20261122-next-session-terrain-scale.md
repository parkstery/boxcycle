# 다음 세션 인계 — 지형 배율 1.3 / 1 수동 비교 준비

작성 Codex · 2026-11-22. 이 세션은 인계만 준비했다. 지형 배율 변경·추가 주행·배포는 수행하지 않았다.

## 다음 작업

Chief가 직접 주행하며 비교할 수 있는 **로컬 지형 배율1.3/1 프리뷰**를 준비한다. 기존 커스텀 선 후보와 분리하고, 기본 지도 렌더링에서 배율만 비교한다. 제품 기본값1.3과 배포본을 임의로 변경하지 않는다. 정적/단위 검증·빌드·프리뷰 연결 확인까지 담당하고, 자동 주행/성능 실험은 실행하지 않는다. 준비 후 따옴표로 감싼 절대경로 실행 명령과 주소·확인 순서를 제공한다.

## 이어받을 사실

- 작업 폴더 `C:\20.HDev\boxcycle`, 브랜치 `main2`. 다수 기존 미커밋 변경 혼재. 시작할 때 실제 git 상태와 HANDOFF를 다시 확인하고 타인 변경을 보존한다. 임의 커밋·푸시·배포 금지.
- Chief는 기존 FPS 개선에 실주행 효과가 없다고 보고했다. 줌 고정으로 지형 위 선 재그리기를 없애는 접근을 채택하지 않는다.
- 별도 선 표현식 고정+커스텀 렌더 후보의 로컬40.06FPS는 제한된 국소 실험값이다.
- Chief v2 직접 시험 화면: 선 표현식만12.4FPS/p95 110.1ms → 커스텀 후보29.6FPS/p95 40.1ms → 기준12.4FPS/p95 100.0ms. 서로 다른 주행 위치/시점이므로 정확한 A/B 효과량은 아니다.
- 후보에서 지형이 일시 정지하고 라이더만 움직여 보이는 현상을 Chief가 관찰했다. **현재 커스텀 후보 UX 불합격·제품 이식 보류.** 코드에 의도적 지형/카메라 고정은 없다. 원인은 미확정이며 다음 배율 비교와 섞어서 고치지 않는다.
- `exaggeration:1.3`은 지도 DEM 높이 배율이다. 표고 그래프를1.3배로 만든다는 의미가 아니다. 그래프는 별도 Open-Meteo/캐시·도로형 보정 프로필을 사용한다. 그래프 값·축·코칭은 이번 범위 밖이다.
- 1.3→1은 정점·레이어 수를 직접 줄이지 않는다. 가시 범위·카메라 회피 보정의 간접 변화는 가능하지만 성능 방향/크기는 미측정이다. 1배도3D이며 자동평면0배와 구분한다.

## 필요한 코드 위치

- `apps/web/src/components/map/rideCameraFollow.ts` — `setTerrain`, 현재 정상1.3/자동평면0.
- `apps/web/src/components/map/rideCameraTerrain.ts` — `TERRAIN_EXAGGERATION=1.3`, 표시 높이·카메라 여유·시선 보정.
- `apps/web/src/components/map/rideTerrainGuard.ts` — `DISPLAY_EXAGGERATION=1.3`, 표시 지형 기준 health 판정 및 자동평면/복귀.
- `apps/web/src/lib/map/riderPreservedLayer.ts` — exaggerated 고도 조회로 지형 위 라이더를 배치한다. 필요 범위만 확인한다.
- 이 묶음 `tools/manual-reuse-preview.js` — v2 전환판, 준비 조건에1.3 전제. 현재는 선 표현식/커스텀 후보를 조작하므로 배율 비교 시 기본 모드로 확실히 분리해야 한다.
- `tools/run-manual-reuse-preview.mjs` — 기존 수동 프리뷰 실행기. 로컬 Firebase 에뮬레이터·생산 빌드, localhost5212, CSP 격리. 프리뷰 빌드는 `tmp/terrain-perf/manual-preview-dist`. 실행 중일 수 있으므로 포트/프로세스를 읽어서 확인하고 사용자 시험을 임의 종료하지 않는다.
- 관련 검증: `apps/web/scripts/map/ride-camera-terrain.test.ts`, `ride-terrain-guard.test.ts`, `ride-terrain-lifecycle.test.mjs`; 전환판 회귀는 이 묶음 `tools/manual-reuse-preview.test.mjs`.

## 구현·검수 조건

1. 필요한 파일만 읽고 배율 전달 경로를 정한다. 지도 배율만1로 바꾸지 말고 카메라 높이 보정·guard·자동평면/3D 복귀가 같은 선택 배율을 사용하도록 한다. 기존1.3 기준 상수를 남긴 채 지도만 변경하면 잘못된 보정/height 확인 실패가 생길 수 있다.
2. 실험 설정은 로컬 수동 프리뷰에 한정한다. 사용자에게 현재 배율과 실제3D/자동평면 상태가 명확히 보여야 한다. 원본 지형1배 선택에서 카메라·도로·라이더가 연속적으로 움직여야 한다. FPS를 높이기 위한 카메라 고정/주기 제한·레이어 숨김·선 표현식 고정·커스텀 렌더는 적용하지 않는다.
3. 지상고/시야 여유3m/0.6m·결측 보호·수동3D OFF·자동평면 복귀 정책은 보존한다. 지도 배율1.3/1과 자동평면 전환을 관련 시험으로 확인한다. 화면 고정 목록을 먼저 확인하고 기존 UI를 재설계하지 않는다.
4. 같은 코스·속도·카메라·화면 크기·실효DPR·스타일·레이어를 비교 조건으로 안내한다. 배율별 실제 카메라 자세가 달라질 수 있음을 기록하고, 단순 반복 전환 수치를 동일 장면 효과량으로 단정하지 않는다. 가능하면 복사 결과에 배율/기준 모드/실제3D 상태를 포함해 계측의 귀속을 분명히 한다.
5. Chief가 직접 주행 시험한다. 에이전트는 관련 회귀·문법/타입·빌드·서버 연결 확인까지만 수행한다. 불필요한 전체 재시험·장시간 브라우저 반복을 피한다. 물리 폰 성능이나 사용자 주행 확인을 완료로 보고하지 않는다.

## 이전 검증과 재개 명령

v2 전환판 회귀4/0·문법·HTTP 갱신 확인 PASS. 실제 WebGL/동작 품질은 위 Chief 관찰대로 불합격이다. 실행기 `--refresh-ui`는 정적 전환판만 갱신하며 제품 TS 변경은 재빌드해야 한다.

```powershell
node "C:\20.HDev\boxcycle\scripts\handoff-check.mjs"
node --test "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\manual-reuse-preview.test.mjs"
```

기존 프리뷰를 그대로 다시 띄우는 명령은 아래와 같지만 **현재는 배율 선택 기능이 없다.** 다음 세션에서 준비를 끝낸 뒤 새 사용법을 다시 보고한다.

```powershell
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\run-manual-reuse-preview.mjs"
```

기존 주소 `http://127.0.0.1:5212/?maxdpr=1.5&perflab=1`은 개발PC 전용이다. maxdpr은 상한으로 기기DPR1이면 실효1이다. 별도 지시 없이 폰 공개 접속이나 배포 작업으로 확장하지 않는다.

상세 근거: [실험·Chief 검수·1.3배 의미](20261122-reuse-approach.md), [묶음 README](README.md), [HANDOFF](../HANDOFF.md).
