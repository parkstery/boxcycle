# 지시 P4 — 실제 지도 위 s5 ↔ rider14 나란히 캡처 (Chief 육안 승인용)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — OpenCode Muse Spark |
| 선행 | P2b · P3 감리 통과 |
| 계획 | [01-plan.md §6 P4 · G4](01-plan.md) |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p4.md` |

## 조건

- dev 서버: Supervisor 가 띄워 둔 `http://localhost:5040` 만 쓴다(새로 띄우거나 끄지 않는다).
- 페이지: `scripts/rider-preserve/rider-perf-bench.html` 에 `animate=0` 과 `riderModel=s5|rider14` 를 붙인다. 위상은 `phase` 쿼리를 새로 받게 해도 된다(벤치 페이지 수정은 **쿼리 추가만** 허용, 기본 동작 불변).
- Playwright headless, GPU 기본 경로, 1280×800, `deviceScaleFactor: 2`. 지도 `idle` 후 1.5초 대기하고 캡처.

## 캡처 목록 (각각 s5 · rider14 같은 조건으로 한 쌍)

| # | 이름 | 조건 |
|---|---|---|
| 1 | `near-side` | zoom 22.5, pitch 75, bearing 0 (라이더 측면), riders 3 |
| 2 | `near-persp` | zoom 22, pitch 67, bearing -32 (P0 와 같은 구도), riders 3 |
| 3 | `shoe` | zoom 23.5, 본인 라이더 오른발이 화면 중앙에 오도록 center 조정, pitch 70, riders 1 — **신발 갑피(D4 승인 항목) 확인용** |
| 4 | `phase-0/90/180/270` | #1 구도, riders 1, 위상 4개 — 페달·발·무릎 위치 확인 |
| 5 | `mid` | zoom 19, pitch 60, riders 3 |
| 6 | `far` | zoom 17, pitch 60, riders 3 |

출력: `apps/web/scripts/rider-preserve/.out/rider14/p4/<이름>-s5.png`, `<이름>-rider14.png`.

## 나란히 합본

각 쌍을 좌(s5) · 우(rider14) 로 붙이고 위쪽에 이름표(`s5` / `rider14`)를 넣은 `pair-<이름>.png` 를 만든다. 도구는 Playwright 페이지 캔버스 또는 Python Pillow 중 가능한 것을 쓴다(설치 금지 — 없으면 Playwright 로).

## 컬러 키트 픽셀 샘플

`near-persp` rider14 캡처에서 세 라이더(self/peer/pacer)의 헬멧 윗면 1점·저지 등판 1점의 화면 픽셀을 읽어 기록한다(좌표 포함). 조명이 들어가므로 키트 원색과 같을 필요는 없다. **s5 같은 점의 픽셀과 채널별 차이**를 표로 낸다.

## 조명 조절판

`?lightlab=1` 이 벤치 페이지에서도 동작하면 #2 를 그 상태로 한 쌍 더 캡처한다. 동작하지 않으면 그 사실만 적는다(앱 코드 수정 금지).

## 결과 파일 `03-result-p4.md`

캡처·합본 전체 경로 목록, 픽셀 표, 관찰(다르게 보이는 곳을 사실대로: 위치·부위·어떻게), 콘솔 오류 유무, 변경 파일.

## 금지

앱 코드(`src/**`) 수정, 조명값 변경, commit · push · `npm install`, 백그라운드 프로세스 남기기.
