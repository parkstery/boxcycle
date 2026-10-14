# 결과41 — 센서 설정의 선택 상태와 여백 정리 (Developer)

- 지시: `02-task-41.md` (지시41)
- 일자: 2026-10-15
- 역할: Developer (MuseSpark1.3)
- cwd: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`
- 소유 파일만 수정: `apps/web/src/components/sensor/CadenceSensorSheet.tsx`, `apps/web/src/components/sensor/CadenceSensorSheet.css`
  (지시상 `components/sensor/...` 표기는 실제 경로 `apps/web/src/components/sensor/...`에 해당)

## 구현 내용

### 1. CadenceSensorSheet.tsx
- `const manualSelected = manualReady && !cadenceMode;` 추가 (표기 분기 전용, 행동 조건 불변).
- h2 제목: `manualSelected`이면 `체험 속도`, 아니면 기존 `케이던스 센서`.
- title-status: `manualSelected`이면 `선택됨`, 아니면 기존 `cadenceSensorShortStatus(props)` 그대로.
- 불변 유지: dialog `aria-label="케이던스 센서"`, `센서 설정 닫기`, scrim `닫기`, `센서 없음` 텍스트/aria-pressed/callback(`onClose/onConnect/onDisconnect/onChooseManual/onChooseCadence`), `showReconnect/allowFirstSetup` 조건, deviceLabel/rpm 표시, blocked/help/unsupported/연결중/실패/단절/riding 안내 분기 전부 그대로.
- 센서 연결 버튼: `manualReady`이면 secondary(`cadence-sheet__btn`만), 미선택이면 기존 primary(`--primary`) 유지.
- 센서 속도로 전환 버튼: 기존 primary 그대로. 센서 없음 selected(`--on`) 표현 그대로.

### 2. CadenceSensorSheet.css
- `.cadence-sheet__panel`: `gap 0.5rem → 0.35rem`, `padding-bottom 1rem → 0.65rem` (상/좌우 불변).
- `@media (max-height: 560px)` 폰 가로: `gap 0.35rem → 0.22rem`, `padding-bottom 0.6rem → 0.4rem`.
- `.cadence-sheet__handle`: `margin-bottom 0.15rem → 0` (width 2.4rem/height 0.22rem 유지).
- 불변: 글자/버튼 padding·크기, 시트 폭 18.17rem, overflow 상한(70%/88%), 애니메이션, 닫기 행동.
- 허용 범위 내 추가: `.cadence-sheet__close:focus-visible, .cadence-sheet__btn:focus-visible`에 `outline 2px solid #2563EB; outline-offset 2px`만 추가 (레이아웃 크기 불변, outline은 박스 크기 미변경).

## 정적 검사 (자원정책: browser/tsc 금지, diff + 정적조건만)

- `git diff --check` → exit 0, PASS (공백 오류 없음).
- `git diff` 정적 확인 → 위 2개 파일 분량만 본인 변경:
  - tsx: manualSelected 분기 + 센서연결 primary 조건 2곳.
  - css: gap/padding/handle 4값 + focus-visible outline 1블록.
- 금지 준수: commit/push/merge/deploy/server/하위agent 미실행. tsc 미실행. browser 미실행. 해당 2파일 외 조사 없음.
- 작업트리 내 타 담당자 dirty 파일 다수 존재(예: MenuPanel/UserInfoSheet/MapView 등) — 본인은 손대지 않음.

## Supervisor 인계 (지시41 자원정책)

- Supervisor는 구현 끝난 뒤 한 번만 `tsc`/selector 계약 실행 → 단일 headless 브라우저/한 page로 740×300·PC 대표 상태 5개 + 실제 Guest 체험 선택 1회 검수.
- 서버 5013 재사용, 추가 서버/병렬 browser/전체 testsuite 금지.
- 실기기 BLE/실제 주행 미검증 구분 보고 필요.

## 상태

- Developer 정적 검사: PASS (`git diff --check` exit 0).
- tsc: 미실행 (자원정책).
- browser 검수: 미실행 (자원정책, Supervisor 1회 검수 대기).
