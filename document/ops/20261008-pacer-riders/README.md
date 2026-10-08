# 20261008-pacer-riders

| 항목 | 내용 |
|---|---|
| 목적 | 혼자 달리는 라이더 곁에 **페이서 2명**(내 속도 기반 로컬 가상 라이더)을 붙여 ±20m 안에서 추월·피추월을 경험하게 한다 |
| 상태 | **APPROVED** · Chief 육안 승인(2026-10-08, 「대폭 개선」) · main2 병합·배포 |
| Chief 결정 (2026-10-08) | 이름 「페이서」 · 기본 켜짐 · 설정에서 끌 수 있음 · 트래픽 0 이므로 2명 |
| Supervisor | Claude · Developer: Cursor CLI |
| 계획 | [01-plan](01-plan.md) |
| 지시 | [01](02-task-01.md) |
| 결과 | Cursor 구현 후 중단, Supervisor 직접 검증 — [검수 01](04-review-01.md) |
| 다음 | 남은 작은 「톡」(내 표시 거리 전진 불균일, 내 라이더와 공유)은 필요 시 별도 묶음 |

실행(루트 `C:\20.HDev\boxcycle` 에서):

```
agent -p --workspace C:\20.HDev\boxcycle "document/ops/20261008-pacer-riders/02-task-01.md 을 읽고 지시된 범위만 수행한 뒤 결과 파일을 작성하라"
```
