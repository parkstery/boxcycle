# 지시 09-2 — 주행 결과 「닫기」를 ✕ 아이콘 버튼으로, 우상단 구석

- 담당: Developer(Cursor CLI) · 보고: `03-result-09b.md` · 커밋 **금지**
- 전제: 지시 09 결과(미커밋) 위에서 작업. 되돌리기·stash 금지. 허용 파일 밖 수정 금지(지시 06 병행 가능성).

## Chief 요구 (2026-10-06)
닫기 버튼을 텍스트(「닫기」)가 아니라 **✕ 버튼**으로, 시트 **우상단 구석**에 둔다.
참고 선례: 경로 선택 창 `RouteListModalShell` 의 `oc-modal__close`(absolute top/right, 1.9rem 원형, 투명 배경, ✕ `aria-hidden`) — 같은 모양·크기로 맞춘다.

## 요구
1. `RideSummarySheet.tsx` 헤더의 `ride-summary__close` 를 ✕ 아이콘 버튼으로. **접근성 이름 `aria-label="닫기"` 유지**(e2e 다수가 `getByRole('button', { name: '닫기' })` 사용 — 계약).
2. 위치: 시트 우상단 구석(absolute). 헤더 「주행 결과」 줄이 ✕ 자리만큼 오른쪽 여백을 갖고, 지시 09에서 그 줄에 넣은 요소(있다면)와 겹치지 않을 것.
3. **표시 조건은 그대로**: 저장할 것이 있으면(`adhocSaveAvailable`) 「저장 안 함」이 닫는 역할이라 ✕ 를 숨기는 기존 규칙(「닫는 버튼은 상태마다 정확히 하나」 주석) 유지.
4. 터치 목표 44px 규칙(시각 크기는 작게, `::after` 등으로 확장 — 기존 D2 관례) 준수.

## 허용 파일
`components/ride/RideSummarySheet.tsx/.css`.

## 완료 조건
1. tsc 0, eslint 증가 0.
2. 에뮬레이터 포트 8080 이 빌 때까지 대기 후 `npm run test:e2e:ride-summary` 통과.
3. 촬영 690×275·1000×640: 저장 없음(✕ 보임)·저장 있음(✕ 없음) 각 1장. 임시 spec 삭제.
4. `03-result-09b.md`.
