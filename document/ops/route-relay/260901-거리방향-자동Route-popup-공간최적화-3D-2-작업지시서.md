# 거리·방향 자동 Route — popup 공간 최적화·거리 ± 조작 3D-2 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 사용자 확인 UI 보완** |
| 최초 작성 | 2026-09-01 |
| 상태 | **실행 대기 — 3D-1-R1 로컬 커밋 후 착수** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-3D-2` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/distance-auto-route-ui-unification` |
| 선행 작업 | `DISTANCE-AUTO-ROUTE-3D-1-R1` 후속 로컬 커밋 |
| 연결 문서 | [재탐색 연속성 3D-1-R1](260901-거리방향-자동Route-생성후-재탐색-연속성-3D-1-R1-작업지시서.md) |

## 1. 목적

지도 위 popup·패널·카드는 도로와 Route를 가린다. 이번 작업은 자동 Route 설정 popup의 기능과 정보량은 유지하면서 불필요한 줄·빈 공간·작은 조작점을 제거해 세로 높이를 줄인다.

사용자 확인에서 다음 낭비가 확정됐다.

1. `경로 생성 잔여 토큰 0개`와 `경로 토큰 부족`이 두 줄을 차지한다.
2. 이동수단 아이콘 오른쪽은 비어 있는데 `경로 삭제`가 별도 줄을 차지한다.
3. 숫자 입력의 브라우저 기본 상·하 spinner는 스마트폰에서 너무 작다.
4. 숫자 입력 쪽 여백 때문에 slider가 짧다.

첨부 화면은 문제 확인용일 뿐이다. 보고용 screenshot이나 해상도별 캡처 산출물을 만들지 않는다.

## 2. 선행 조건과 작업 순서

이 작업을 현재 미커밋 R1 변경에 섞지 않는다.

1. Cursor/IDE가 실제로 `C:\20.HDev\boxcycle-distance-auto-route-ui-circle`을 열었고 브랜치가 `feat/distance-auto-route-ui-unification`인지 확인한다.
2. `DISTANCE-AUTO-ROUTE-3D-1-R1` 변경을 정상 pre-commit이 통과한 후 별도 로컬 커밋으로 남긴다.
3. 그 R1 커밋을 3D-2의 parent로 사용한다.
4. 루트 checkout `C:\20.HDev\boxcycle`의 제품 파일에는 변경을 적용하지 않는다. 루트의 기존 문서 변경을 보존한다.

Cursor 화면 하단에 `feat/distance-based-auto-route`가 표시되는 상태라면 `Keep All`로 제품 변경을 루트 checkout에 적용하지 말고, 먼저 올바른 폴더·브랜치로 전환한다.

## 3. 확정 UI

### 3.1 Token 정보는 한 줄

- 잔액과 보조 상태를 하나의 시각적 행에 표시한다.
- 잔액 0·부족 상태의 정확한 형태는 다음과 같다.

```text
경로 생성 잔여 토큰 0개 · 경로 토큰 부족
```

- 잔액과 보조 상태 사이에는 짧은 구분자 `·`를 둔다.
- 부족·차감 완료·탐색 중 보조 문구가 있을 때도 별도 두 번째 줄을 만들지 않는다.
- 보조 문구가 없으면 잔액만 표시하고 빈 요소가 높이를 차지하지 않게 한다.
- popup 지원 최소 폭에서 문구를 임의로 잘라 숨기지 않는다. padding·gap·font 크기를 popup 범위 안에서 조정해 한 줄을 우선한다.
- 색상으로만 부족·성공·진행을 구분하지 않고 기존 텍스트와 `role="status"`·`aria-live` 계약을 유지한다.

### 3.2 이동수단 아이콘과 `경로 삭제`는 같은 행

- 자동차·자전거·도보 아이콘 3개 뒤의 빈 공간에 `경로 삭제`를 오른쪽 정렬한다.
- `경로 삭제`를 위한 별도 행·별도 상단 여백을 제거한다.
- DOM/키보드 순서는 이동수단 3개 다음 `경로 삭제`로 한다.
- 각 이동수단의 기존 선택 상태·비활성 상태·`aria-label`을 유지한다.
- `경로 탐색 유형 선택`/`이동수단` 텍스트 때문에 별도 한 줄이 생기지 않게 한다. 아이콘 그룹의 접근 가능한 이름은 screen-reader-only label 또는 동등한 `aria-labelledby`로 유지한다.
- `경로 삭제`는 Start·End·Route geometry·자동 세션·목표 거리 원을 지우는 기존 동작을 그대로 유지한다.

### 3.3 숫자 spinner 제거와 slider 좌우 ± 버튼

- 목표 거리를 직접 숫자로 입력하는 기능은 유지한다.
- 브라우저 기본 상·하 spinner가 생기는 `input type="number"`는 사용하지 않는다.
- 직접 입력은 모바일 숫자 키보드가 뜨도록 `inputmode="decimal"`과 적절한 접근성 label을 사용한다.
- slider 바로 왼쪽에 `−`, 바로 오른쪽에 `+` 버튼을 둔다.
- `−`/`+`의 시각적·클릭 hit area는 각각 최소 `40 × 40 CSS px`로 한다. 작은 삼각형을 별도 hit target으로 만들지 않는다.
- 증감 단위는 현행 `0.5 km`, 범위는 현행 `0.5–120 km`를 유지한다.
- 최솟값에서는 `−`, 최댓값에서는 `+`를 비활성화한다.
- 버튼·slider·직접 입력은 같은 `targetKm`을 양방향 동기화한다.
- 증감 버튼 1회는 값 동기화·목표 거리 원 갱신·방향 선택 준비를 각각 1회만 일으킨다. 지도 방향 클릭 전에는 provider 호출과 Token 차감이 없어야 한다.
- 유효하지 않은 직접 입력은 현행 검증 문구로 차단하고 마지막 유효한 목표 거리와 기존 Route를 파괴하지 않는다.

권장 한 행 구조는 다음과 같다. `목표거리(km)` 시각 label이 별도 폭을 차지한다면 screen-reader-only로 전환할 수 있다.

```text
[−] [──────── slider ────────] [+] [55.0]
```

숫자 입력 폭과 불필요한 오른쪽 여백을 줄여 확보한 공간은 slider에 배정한다. popup 전체 폭을 키워 해결하지 않는다.

### 3.4 전체 높이·간격

- Token, 이동수단/삭제, 거리 조작, 상태 안내 사이의 중복 margin·padding을 줄인다.
- 한 줄로 표현 가능한 내용을 두 줄로 강제하지 않는다.
- 주소·좌표·Start/WP/End·Token·이동수단·거리·상태의 정보 우선순위는 유지한다.
- 새로운 카드·설명 panel·재탐색 버튼·tooltip을 추가하지 않는다.
- popup의 현행 최대 폭을 넓히지 않는다.

## 4. 3D-1-R1 회귀 금지

레이아웃 변경 후에도 다음을 모두 유지한다.

1. Route A 성공 후 같은 popup에서 새 지도 클릭으로 Route B 탐색
2. B 탐색 중 A geometry·End 유지, B 성공 후에만 교체
3. A/B 요청마다 서로 다른 requestId
4. 성공 1회마다 Route Token 1개 차감, 실패 시 환불·A 유지
5. 잔액 0이면 provider 호출 전에 차단
6. popup 닫힘 뒤 일반 지도 클릭은 자동 요청을 보내지 않음
7. popup 재개방 후 마지막 목표 거리·profile 복원
8. 자동 세션에서 profile 변경 시 기존 End 수동 재계산 금지
9. 거리 slider·숫자 입력·± 버튼 조작만으로 Token을 소비하지 않음
10. 거리 조작을 하지 않은 수동 Route의 End 직접 지정 흐름 유지

## 5. 시험 보완

현재 거리 자동 Route 계약의 소스 정규식 존재 확인만으로 완료 판정하지 않는다. 최소한 상태 계산 helper 또는 DOM 단위 시험으로 다음을 고정한다.

1. 잔액 0 + 부족 상태가 하나의 행에서 `경로 생성 잔여 토큰 0개 · 경로 토큰 부족`으로 조합됨
2. 보조 상태가 없을 때 구분자와 빈 두 번째 줄이 없음
3. 이동수단 버튼 3개 다음에 `경로 삭제`가 같은 action row에 존재
4. 목표 거리 직접 입력에 native number spinner가 없음
5. `−`/`+` 버튼이 각각 0.5 km 증감하고 min/max에서 clamp·disable
6. ±·slider·직접 입력이 동일한 목표 거리와 원 preview로 동기화
7. 조작만으로 `getDistanceAutoRoute` POST가 발생하지 않음
8. Route A→B requestId·Token·geometry·실패 보존 회귀 유지

필수 게이트:

```powershell
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build
npm -w boxcycle-web run lint
git diff --check
git show --check HEAD
```

`test:route-token`은 5001 등 harness 포트가 비어 있어야 한다. 개발팀장이 자신이 띄운 dev server라면 정상 종료 후 시험하고, 소유자를 확인하지 않은 process를 강제 종료하지 않는다. 포트 충돌로 시험하지 못했다면 통과로 보고하지 않는다.

화면 검증은 지원되는 가로형 스마트폰 viewport 1개와 데스크톱 1개에서 다음만 최소 확인한다.

- Token 부족 문구 한 줄
- 이동수단 3개와 `경로 삭제` 같은 행
- ± 버튼 hit area와 직접 입력
- popup 높이 감소 및 지도 조작 가능
- Route A→B 재탐색 유지

보고용 screenshot·해상도별 캡처 파일은 만들지 않는다. 브라우저 검증이 5분 동안 진전 없으면 포트·Console·Network·Functions 연결과 자동 시험으로 전환한다.

## 6. 사용자 직접 확인 안내

완료 보고에는 다음을 빠짐없이 적는다.

1. worktree 절대경로
2. 정확한 실행 명령
3. 실제 URL·실제 포트
4. Functions/Firebase Emulator 추가 실행 필요 여부와 명령
5. 서버 재시작 필요 여부와 개발팀장이 띄운 기존 process의 종료 방법
6. 일반/강력 새로고침 중 필요한 방식
7. 최소 재현 절차와 단계별 기대 결과
8. 문제 발생 시 전달할 Console/Network 항목

## 7. Git 완료 방식

- R1 후속 커밋을 amend·reset·rebase하지 않는다.
- 3D-2는 같은 브랜치에 별도 후속 로컬 커밋으로 남긴다.
- 정상 pre-commit이 통과할 때만 커밋한다.
- 사용자 확인 전 push·PR·merge·deploy하지 않는다.

권장 제목:

```text
style(route): compact auto route popup controls
```

완료 보고:

1. R1 commit hash와 3D-2 commit hash·parent
2. 변경 파일·줄 증감
3. Token 단일 행·아이콘/삭제 단일 행·± 거리 조작 시험 증거
4. Route A→B 회귀 시험 결과
5. build·lint·diff check 결과
6. worktree clean 여부
7. push·PR·merge·deploy 없음
8. §6 형식의 사용자 직접 확인 안내
