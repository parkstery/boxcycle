# 감리 P4·P5·P6·P7 — 큰 파일·CSS·디버그 화면·재발 방지 게이트

2026-10-22 · review · Claude · **APPROVED**

## P5 CSS 죽은 선택자 (지시09, MiniMax)

- 목록 146 클래스 → 선택자 201개 제거, CSS 소스 **−1,345줄**, 번들 CSS 230.5 → **211.8 kB (−8.1%)**. 커밋 `c437bc94`.
- 판정 기준: `ui-800x360`·`route-media-controls`·`distance-route-result-layout` 17건이 정리 전과 **같은 16 통과·같은 1 실패**. 실패 1건(「시작·센서·접기 조작」)은 정리 **전부터** 실패하던 것 — UI 묶음의 기존 결함, 이번 범위 밖.

## P6 디버그 화면 분리 (지시10, MiniMax)

- `DebugMapStage`·`ActivityWorldLodDebugPanel` 을 `React.lazy` 로 분리(5.2 kB·1.5 kB 청크). 커밋 `66b9e77c`.
- 계측기(`note…` 함수, `dev-tools.json` permanent 19파일·소스 약 97 KB)는 주행 중 호출되므로 그대로 둔다.
- 부작용: 번들러가 공유 코드를 `camera1Mode-*.js`(1.75 MB, modulepreload) 로 떼어 기본 청크가 3,737 → 1,982 kB 로 보이지만 **총량은 같다**. `vite preview` 로 빌드본을 띄워 청크 4개 200·콘솔 오류 0·인트로 화면 정상 확인.

## P4 큰 파일 (지시11·12·13, Claude impl-standard)

| 파일 | 전 | 후 | 방법 | 커밋 |
|---|---:|---:|---|---|
| `MapView.tsx` | 3,589 | **3,403** | ref 동기화 효과 40개 → 제자리 `useAssignRef`, 최상위 보조 함수 3파일로 | `881217ea` |
| `mapPopupElements.ts` | 1,176 | **1,007** | 마커·활동 팝업 7함수 → `mapMarkerElements.ts`, 재내보내기 | `a62c13c0` |
| `App.tsx` | 3,752 | **3,656** | 지도·카메라 상태, 센서 준비 → 훅 / 계기판 값 → 순수 함수 | `6cb92f84` |

감리가 직접 본 것:

- `useAssignRef` 는 원래와 같은 `useEffect` 안 대입이라 실행 시점이 같고, 선언 순서 그대로 제자리에서 호출된다. 진입 위치 시험이 AST 로 찾는 효과 2개는 남겼다.
- `App.tsx` 에서 의존성 배열에 추가된 16+α 개 식별자를 하나씩 대조 — 전부 `useState` setter 이거나 `useRef` 객체(정체성 불변 → 효과가 더 자주 돌지 않음). 린트 경고는 원래 7건으로 복귀.
- 옮긴 훅 파일의 `eslint-disable react-hooks/refs` 는 `eslint.config.js` 가 `App.tsx` 에만 둔 예외와 같은 범위, 이유 주석 붙임.
- **남긴 것:** `rideControlPanel` JSX(센서 칩 계약 시험이 `App.tsx` 문자열을 겨눔), auto-route 클릭 디버그 마커 함수(클릭 의도 시험이 `MapView.tsx` 문자열을 겨눔). 시험을 고치지 않는다는 원칙으로 보존 — 더 줄이려면 시험의 겨눔 대상을 옮기는 별도 결정이 필요하다.
- `App.tsx`·`MapView.tsx` 는 여전히 1,200줄 상한을 넘는다. 이번엔 위험이 낮은 덩어리만 뗐고, P7 게이트가 **더 커지지 못하게** 묶는다.

## P7 재발 방지 게이트 (Claude 직접)

- `scripts/check-code-tidy.mjs` + `apps/web/code-tidy.baseline.json`, pre-push 10번째 게이트. 커밋 `61a0543a` 외.
- 늘면 실패: knip 안 쓰는 export 186·타입 44·파일 1·두 이름 7 / 반복 줄 18 / 1,200줄 초과 파일 4개(각 현재 줄 수가 상한).
- 기준선에 측정 규칙 지문(knip 설정·jscpd 옵션·상한) — 규칙을 넓혀 통과시키면 실패.
- 생존 확인(깨뜨려 보기 4건, 모두 의도한 측정으로 실패): export 186→187 · 규칙 지문 변경 · App.tsx 3,657→3,667 · 반복 18→44. `verify-gates-alive.mjs` 에 같은 4건 등록. 전체 스크립트는 작업 트리에 남의 비추적 파일(`cdbox.bat`·`.out/`)이 있어 4건만 따로 돌렸다.
- 실행 시간 약 15초.

## 검증 (감리 직접, 마지막 커밋 기준)

tsc 0 · 의존 방향 위반 0 · lint 오류 0 · 단위 1,341 · `test:e2e:ride` 7/7 · UI 배치 16/17(기존 실패 1 동일) · 빌드본 preview 콘솔 오류 0.
