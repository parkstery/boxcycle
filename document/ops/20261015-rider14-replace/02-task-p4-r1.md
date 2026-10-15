# 지시 P4-R1 — P4 마무리 (Developer 교대: Cursor)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | **Developer — Cursor Agent CLI** (Chief 지시로 Muse Spark → Cursor 교대. Muse 는 사용량 한도로 P3·P4 연속 중단) |
| 원 지시 | [02-task-p4.md](02-task-p4.md) — 조건·금지는 그대로 |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` (브랜치 `rider14-replace`) |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p4.md` |

## 먼저 읽을 것

1. 묶음 [README.md](README.md) — 지금까지 기록 표
2. [01-plan.md](01-plan.md) §0·§5·§6 — 무엇을 왜 하는지
3. [02-task-p4.md](02-task-p4.md) — 원 지시
4. [04-review-p0.md](04-review-p0.md) 의 "Developer 운영 지적"

## 이미 된 것 (Supervisor 대행, 다시 찍지 않는다)

- 캡처 스크립트 `apps/web/scripts/rider-preserve/.out/rider14/p4/capture-p4.mjs` 로 9쌍 캡처: `near-side`·`near-persp`·`rider-close`·`shoe`·`phase-0/90/180/270`·`mid`·`far` (`<이름>-s5.png` / `<이름>-rider14.png`). 지도 최대 줌이 22라 근접 컷은 DPR 4–6 으로 찍고 라이더 주변을 잘랐다(스크립트 `clip` 값 참고).
- 합본 스크립트 `pair.py` (Python Pillow) → `pair-<이름>.png`.
- 벤치 페이지 `rider-perf-bench.ts` 에 `phase`(도) 쿼리 추가 — 기본 45° 로 기존 동작 동일.

## 할 일

1. `python scripts/rider-preserve/.out/rider14/p4/pair.py` 실행(`apps/web` 에서) → 9개 합본이 모두 생기는지 확인.
2. **컬러 키트 픽셀 표** (원 지시 §컬러 키트 픽셀 샘플): `near-persp-s5.png`·`near-persp-rider14.png` 에서 세 라이더(self 주황, peer 청록, pacer 슬레이트)의 **헬멧 윗면 1점·저지 등판 1점**을 골라 좌표와 RGB 를 표로. s5 와 rider14 같은 좌표의 채널별 차이를 적는다. 좌표는 이미지를 열어 직접 고른다(자동 집계 금지 — 배경과 섞인다).
3. **조명 조절판**: `rider-perf-bench.html?…&lightlab=1` 로 열어 조절판이 뜨는지만 확인. 뜨면 `near-persp` 구도로 한 쌍 더 캡처(`lightlab-s5.png`/`lightlab-rider14.png`, 캡처 스크립트에 항목 1개 추가해도 됨). 안 뜨면 그 사실만 적는다.
4. **관찰 기록**: 9개 합본을 하나씩 열어 **다르게 보이는 곳을 사실대로** 적는다(부위·어떻게). 참고로 Supervisor 가 근접 2장에서 본 것: 저지 셰이딩이 매끈해짐, 신발 갑피가 닫힘(s5 는 안쪽이 비쳐 보임). 이 둘은 계획서 F8·D4 로 예상·승인된 차이다. 그 밖의 차이(페달·발·무릎 위치 어긋남, 구멍, 깜빡임, 색 틀림)가 있으면 반드시 적는다.
5. `03-result-p4.md` 작성: 캡처·합본 **전체 경로** 목록, 픽셀 표, 관찰, 콘솔 오류(캡처 로그 `captures.json` 의 `errors` — Mapbox 스타일 일시 fetch 실패는 재시도로 해소됨을 구분), 변경 파일.

## 조건

- dev 서버 `http://localhost:5040` 은 Supervisor 가 띄워 둠 — 새로 띄우거나 끄지 않는다. `127.0.0.1:5040` 은 다른 프로세스.
- 브라우저는 한 번에 하나. 모든 명령 포그라운드, 백그라운드 잔류 금지.
- `npm run …` 은 PowerShell 에서.

## 금지

앱 코드(`src/**`) 수정, 조명값 변경, commit · push · `npm install`, 본 작업트리(`C:\20.HDev\boxcycle`)에는 결과 파일 외 쓰기.
