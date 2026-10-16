# 라이더 근거리 성능 — 실기기 측정 · 싼 최적화 · GPU 스키닝 · 적응형 품질

| 항목 | 내용 |
|------|------|
| 문서 유형 | **작업 계획(ops)** |
| 최초 작성 | 2026-10-16 |
| 상태 | `진행` — Chief 지시: "폰 프레임 시간 측정부터, 싼 방법과 GPU 이전 둘 다" |
| 역할 | Supervisor = Claude · Developer = Cursor Agent CLI · Chief = 실기기·육안 |
| 작업 위치 | worktree `C:\20.HDev\boxcycle-perf`, 브랜치 `feat/rider-perflab`(기준 `main2` `ccd6e4f`) — 단계마다 브랜치를 새로 판다 |

## 0. 배경

P5 데스크톱 실측: 근거리(줌 ≥ 19) 라이더 1명당 0.92 ms, 그중 84% 가 CPU 다리 DQS(정점 약 4,200 개/명/프레임 + 매 프레임 GPU 재업로드). 폰 CPU 는 데스크톱보다 수 배 느려 동행이 늘면 프레임 예산(16.7 ms)을 넘을 수 있다. 모든 폰을 시험할 수 없으므로 **기기 구간별 기준 기기 + 운영 앱 스스로의 적응**으로 간다.

## 1. 단계

| 단계 | 내용 | 게이트 |
|---|---|---|
| **F1 실측 도구** | 운영 빌드에서 `?perflab=1` 일 때만 켜지는 측정 패널 — 프레임 시간 분포, 라이더 렌더·자세 시간, 라이더 수, 줌, GPU/기기 정보, 결과 복사 버튼 | 운영에서 쿼리 없을 때 비용 0(계측 코드가 돌지 않음), 단위 시험, Chief 폰에서 수치 확보 |
| F2 싼 최적화 | 화면 밖·아주 작은 라이더 자세 생략, 동행 자세 프레임 격번 갱신 등 | F1 수치로 전후 비교 |
| F3 적응형 품질 | 프레임 시간이 예산을 넘으면 앱이 스스로 단계적으로 낮춤(동행 자세 빈도 → LOD2 전환 줌 상향 → 흔들림 끔) | 저사양 시뮬레이션(CPU 감속)에서 끊김 없음 |
| F4 GPU 스키닝 | 다리 DQS 를 정점 셰이더로. CPU 경로는 시험·대비용으로 유지 | 동등성(GPU 출력 읽어 CPU 와 비교), 성능, 실기기 |

## 2. F1 설계

- `?perflab=1` (운영 포함) — 기존 `?lightlab=1`·`?camlab=1` 과 같은 패턴. 없으면 계측 함수가 바로 반환(측정 비용 없음).
- 측정: 최근 N 초(기본 10 s) 프레임 간격 p50/p95/p99/최대, 50 ms·33 ms 초과 비율, 같은 기간 `measureRiderRenderFrame`·`measureRiderPose` 누적(라이더 ms/프레임, 자세 비율), 라이더 수, 지도 줌, LOD2 사용 여부.
- 기기 정보: `navigator.userAgent`, `navigator.hardwareConcurrency`, `navigator.deviceMemory`(있으면), `devicePixelRatio`, 화면 크기, WebGL `UNMASKED_RENDERER_WEBGL`(있으면), `MAX_VERTEX_UNIFORM_VECTORS`, 정점 셰이더 `highp` 정밀도(`getShaderPrecisionFormat(VERTEX_SHADER, HIGH_FLOAT)`).
- 패널: 화면 구석 작은 반투명 상자, 1 s 마다 갱신. "결과 복사" 버튼 → JSON 을 클립보드(실패 시 선택 가능한 텍스트 상자). 수집·전송은 하지 않는다(서버 수집은 Chief 결정 후 별도).
- 기존 `riderRenderCostProbe.ts` 의 DEV 전용 가드는 유지하되, perflab 이 켜졌을 때도 동작하도록 조건을 넓힌다(운영 쿼리 없을 때 0 비용 유지).
