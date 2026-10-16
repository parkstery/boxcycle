# 성능 측정 방법 — perflab·mapcut·실GPU 측정 스크립트

| 항목 | 내용 |
|---|---|
| 문서 유형 | **방법 기록**(문제 해결 보고 묶음의 공용 도구) |
| 작성 | 2026-10-17 · Supervisor (Claude) |
| 도입 커밋 | F1 `99c176f`(프레임·라이더 비용) · J1 `58f4fdb`(떨림 줄) · F2 `38fc81f`(프레임 분해) · M1 `079ace0`(`?mapcut=`) · M4 `ffa68af`(패널 왼쪽 이동) |
| 작업 묶음 | [ops/20261016-rider-perf](../ops/20261016-rider-perf/) · [ops/20261016-frame-breakdown](../ops/20261016-frame-breakdown/04-review-f2.md) · [ops/20261016-map-cut](../../ops/20261016-map-cut/) |

## 왜 필요했나

"내가 테스트하는 두세 개가 괜찮으니 모두 괜찮다고 할 수는 없다"(Chief). 체감 대신 **운영 사이트·실기기에서 같은 숫자**를 받아 비교할 수 있어야 했다. 이 세션의 원인 규명(떨림=루프 위상, 지도 비용=장식 글자, 틱=getStyle)은 모두 이 도구로 나왔다.

## 1. 앱 내 패널 `?perflab=1`

운영 URL 뒤에 붙인다(예: `https://boxcycle-dc2df.web.app/…?perflab=1`). 주행 화면 왼쪽에 패널.

| 줄 | 내용 | 읽는 법 |
|---|---|---|
| 기기 | 브라우저·배율·`mapPixelRatio`(예 `지도2x`) | 폰 해상도 상한 적용 확인 |
| 프레임 | fps, 프레임 시간 p50/p95 | 60 Hz 기기에서 16.7 ms 가 한도 |
| 라이더 비용 | 라이더 렌더 CPU ms·draw call | 라이더가 병목인지 |
| 분해 | 앱 틱 구간(self·camera·peer·pacer·markers·spec·sync·nametag), 지도 렌더 JS(`map._render` 감쌈), LoAF, GPU 타이머 쿼리(지원 시), GPU·합성 대기 | **어느 덩어리가 큰지 먼저** |
| 떨림 | 라이더별 역행 수·speedCv·본인 대비 거리 표준편차 | 정상 speedCv ≈ 0 |

**"결과 복사"** 버튼 → JSON 을 채팅에 붙여 넣어 Supervisor 가 분석. PC·폰 같은 코스·같은 카메라로 받는다.

## 2. 부분 끄기 스위치

| 쿼리 | 용도 |
|---|---|
| `?mapcut=terrain,buildings,labels,roads,sky,minimap` (조합) | 지도 요소별 비용 측정 |
| `?labelmode=names\|both\|near\|major\|all\|none`, `?labeldist=` | 주행 글자 모드 비교([글자 보고](261017-RTW-주행-지도-글자-names-모드.md)) |
| `?labels=1` | 주행 글자 숨김 끄기 |
| `?maxdpr=1–4` | 렌더 배율 상한 비교([해상도 보고](261017-RTW-폰-렌더-해상도-상한.md)) |
| `?sway=0` | 흔들림 끄기(**DEV 빌드 전용**, 운영은 무시) |
| `?skin=cpu\|gpu` | 스키닝 경로 비교(G1 진행 중, 기본 cpu) |

## 3. 실GPU 자동 측정 스크립트(PC)

- 경로: `apps/web/scripts/perf/run-real-gpu.mjs` (git 추적). 실행: `node apps/web/scripts/perf/run-real-gpu.mjs`
- **headed** Playwright 로 운영 사이트를 실제 GPU(GTX 1660)로 연다. 헤드리스는 SwiftShader 라 GPU 수치가 무의미.
- 환경 변수: `VARIANTS`(쉼표 구분: `none`, `labelsOn`, `mode-X[@거리]`, `deco` …), `COURSE`(예 `파리`).
- 동작: 코스 선택 → 주행 시작 → 카메라 2 버튼을 `dispatchEvent` 로 클릭 → **줌 ≥ 21 될 때까지 대기** → 일정 시간 perflab 수치 수집.
- 출력: `apps/web/scripts/perf/.out/<날짜시각>/` 의 `report-*.json`, `view-*.png`, `shot-*.png` (`.out` 은 gitignore).
- 실행 전 메모리 확보(브라우저·opencode 등 보조 프로세스 종료). 메모리 압박 중 수치는 버린다.

## 함정

1. **React Profiler 는 운영 빌드에서 no-op** — 운영 측정에 쓸 수 없다. perflab 구간 계측을 쓴다.
2. perflab 패널이 카메라 1·2 버튼을 덮어 스크립트가 **줌 17 에서 측정**한 적 있음 → 패널을 왼쪽으로 옮기고(M4) 스크립트는 줌 도달을 확인.
3. 비교는 **글자 많은 도심 코스**(파리)에서. 숲 코스(남산)는 지도 비용 차이를 가린다.
4. 첫 수 초(타일·모델 로드)는 버린다. 페이서 가속 구간의 speedCv 는 일시적으로 크다.
5. 가설보다 측정 먼저 — 이 세션의 Supervisor 가설 4건(먼 글자, 경로 O(N), 8 ms 시계, pixelRatio 옵션)이 측정·확인으로 뒤집혔다.
