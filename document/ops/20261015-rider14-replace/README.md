# 20261015-rider14-replace

| 항목 | 내용 |
|---|---|
| 목적 | 현재 제품 라이더(s5, 후보 `20260921-041426-cd81398e`)를 경량 모델 **rider14**(같은 형상, 드로우콜 213→14, 삼각형 53,514→29,604, 전송 1.75 MB→245 KB)로 교체한다 |
| 상태 | **DONE_ON_BRANCH** — G0~G6 통과, 브랜치 커밋 완료. main2 병합·운영 배포(G7) Chief 지시 대기 (Chief 결정 2026-10-15: 권장안 전부 수용, 신발 갑피 변경 승인) |
| 계획 | [01-plan](01-plan.md) |
| rider14 원본·보고서 | `C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\20261015_01-s6-poly-drawcall-reduction\reports\결과보고서.md` |
| Supervisor | **Claude** (계획·감리) · Developer: **Cursor Agent CLI** (2026-10-15 23:30 Chief 지시로 Muse Spark 에서 교대 — Muse 무료 모델 사용량 한도) · 작업 위치 worktree `C:\20.HDev\boxcycle-rider14` (브랜치 `rider14-replace`) |
| 다음 | Chief: main2 병합·푸시·운영 배포 지시 |

## 기록

| 순서 | 파일 | 상태 |
|---|---|---|
| 지시 P0 | [02-task-p0](02-task-p0.md) | 1차 불합격 — 실행기 초기화 순서 오류, 결과 파일 없음 |
| 재지시 P0-R1 | [02-task-p0-r1](02-task-p0-r1.md) → [03-result-p0](03-result-p0.md) → [감리](04-review-p0.md) | **APPROVED(조건부)** — 기준선은 Supervisor 재측정값 (1명당 213콜, z22 1.45 ms/rider, 자산 1.98 MB, 첫 표시 3.3 s) |
| 지시 P1 | [02-task-p1](02-task-p1.md) → [03-result-p1](03-result-p1.md) → [감리](04-review-p1.md) | **APPROVED** — candidateId `20261015-212136-df8de090` |
| 지시 P2a | [02-task-p2a](02-task-p2a.md) → [03-result-p2a](03-result-p2a.md) → [감리](04-review-p2a.md) | **APPROVED** — rider14 1명당 14콜/29,604 tri, 보정 4건 P2b 로 |
| 지시 P2b | [02-task-p2b](02-task-p2b.md) → [03-result-p2b](03-result-p2b.md) → [감리](04-review-p2b.md) | **APPROVED** — 주황/청록/슬레이트 구분, 해제 순서 결함 P3 §0 으로 |
| 지시 P3 | [02-task-p3](02-task-p3.md) → [03-result-p3](03-result-p3.md) → [감리](04-review-p3.md) | **APPROVED** — 다리 ≤8 µm, 강체 행렬 차 0, 법선 Int8 양자화 ≤1.11°. 본체는 Muse 사용량 한도로 Supervisor 대행 |
| 지시 P4 | [02-task-p4](02-task-p4.md) | Muse 사용량 한도로 미착수 → 캡처 9쌍은 Supervisor 대행 |
| 지시 P4-R1 | [02-task-p4-r1](02-task-p4-r1.md) → [03-result-p4](03-result-p4.md) → [감리](04-review-p4.md) | **APPROVED** — G4 Chief 승인("계속 진행해") |
| 지시 P5 | [02-task-p5](02-task-p5.md) → [03-result-p5](03-result-p5.md) → [감리](04-review-p5.md) | **APPROVED** — 14콜, ms/rider −35~−85%, 자산 476 KB, 첫 표시 +6%/−3%, 폰 실기기(미리보기 채널) Chief 확인 |
| 지시 P6 | [02-task-p6](02-task-p6.md) → [03-result-p6](03-result-p6.md) → [감리](04-review-p6.md) | **APPROVED** — 제품 기본 rider14(미커밋), 번들 +32.6 KB(gzip +9.6 KB), 운영 빌드 `riderModel` 0건, 로컬 앱 주행 렌더 확인 |
| P7 마감 | [완료 보고](../../archive/261016-RTW-라이더-rider14-교체-완료보고.md) | 결정 로그·진행판·색인 갱신, 브랜치 `rider14-replace` 커밋 |
| 미리보기 | https://boxcycle-dc2df--rider14-k0goz95b.web.app | 만료 2026-10-23, 운영은 s5 |
