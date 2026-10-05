# ops 전체 상태판

마지막 갱신: 2026-10-06. 상세 기록은 각 묶음에, 목표·기능별 진도는 [상태보드](../260707-RTW-기능-인벤토리-상태보드.md), 제품 전체 방향은 [RTW 현황판](../260928-RTW-현황판.md)에 있다.

| 현재 작업 | 단계 | Supervisor | Developer | Chief 승인 | 마지막 검수 | 막힘 | 다음 작업 |
|---|---|---|---|---|---|---|---|
| [칼로리·이어달리기](20261006-calories-resume/README.md) | APPROVED · origin/main2 반영 완료 | Codex | Cursor CLI | 칼로리 변경·재개1개유지 요청 | [18 검수](20261006-calories-resume/18-review-supervisor.md) · [24 push 완료](20261006-calories-resume/24-result-remote-push.md) | 실 Firebase·다중 탭/e2e 미실행 · 원격 반영 완료 | Chief 사용 확인·최종 종료 |
| [내 경로 가독성](20261006-saved-route-readability/README.md) | APPROVED · origin/main2 반영 완료 | Codex | Cursor CLI | Edge 글자 수정 요청 | [03 검수](20261006-saved-route-readability/03-review.md) | Edge 사용자 창 직접 검증 미실시 · 원격 반영 완료 | 사용 확인·종료 대기 |
| [주행 맵 제어](20261005-ride-map-controls/README.md) | APPROVED · 고도 포함 · origin/main2 반영 완료 | Codex | Cursor CLI | 맵 제어·축척 왼쪽 고도 요청 | [09 고도 검수](20261005-ride-map-controls/09-review-camera-altitude.md) | 원격 반영 완료 | Chief 사용 확인·최종 종료 |
| [제품 가치·이름·칼로리](20261005-product-value-name-calories/README.md) | AWAITING_CHIEF · 조사 문서 local 커밋 | Codex | Cursor CLI (ask 조사 exit 0) | 새 경험·명칭·계산 변경은 미채택 | [02 근거·제안](20261005-product-value-name-calories/02-result-and-proposal.md) · 핵심 소스 대조 | 없음 | 경험 검증·새 이름·칼로리 정책 선택 후 별도 작업 |
| [문서 체계 정리](20261005-document-system/README.md) | APPROVED · origin/main2 반영 완료 | Codex | Codex (Cursor CLI 실행 오류 후 직접 수행) | 문서 정리 요청으로 범위 승인 | [03 PASS](20261005-document-system/03-review-document-system.md) · 현재 링크 0오류·이동 0회귀 | 과거 누락 23건 별도 기록 · 원격 반영 완료 | Chief 최종 종료 승인 전 |
| [Foreground read spike](20261003-focus-read-spike/README.md) | APPROVED · main2 FF 완료(로컬) | Codex | Cursor CLI | 행동 보존형 read/write 저감 승인됨 | [21 final PASS](20261003-focus-read-spike/21-review-final-approval.md) · [23 merge](20261003-focus-read-spike/23-result-merge-main2.md) | billed/SDK reconnect 미계측 · push 미실시 | Supervisor/Chief: push·배포 여부 결정 |
| [Public Trail traffic followup](20261002-public-trail-traffic-followup/README.md) | AWAITING_CHIEF (TASK-02R APPROVED) | Codex | Cursor CLI | 배포·트리거/전송 주기·A/B/D 구현 전 필요 | [09 PASS](20261002-public-trail-traffic-followup/09-review-phase-aligned-measurement-rework.md) | 배포 후 정렬된 운영 1/2명 데이터 Ø | Chief: quiet/solo/dual ISO 구간과 분당 read/write 제공 또는 후속 범위 결정 |
| [동행 싱크](sync-relay/INSTRUCTION.md) | PLANNING (기존 대기) | 미지정 | 미지정 | 후속 범위 결정 시 확인 | 기존 S4 기록 | S4-4 재개 보류 | [후속 계획](20260927-peer-competition/260927-RTW-동행-지연과-경쟁-판정.md) 검토 |
| [미니맵](20260923-minimap/HANDOFF.md) | PLANNING (기존 대기) | 미지정 | 미지정 | 미확인 | 지시04까지 병합 | 보류01·02 | 재개 시 새 지시 |

| [동행 경쟁 판정 계획](20260927-peer-competition/README.md) | PLANNING (기존 미착수) | 미지정 | 미지정 | 재개 시 범위 결정 | 기존 09-27 계획, 최신 표시 보고 분리 | 활성 지시 없음 | 재개 시 새 지시 |

종료된 묶음과 이동 가능 여부는 [완료 기록 색인](../archive/README.md)에 보존한다. 이 표의 상태는 각 작업 폴더의 최신 지시·결과·검수와 함께 갱신한다.

