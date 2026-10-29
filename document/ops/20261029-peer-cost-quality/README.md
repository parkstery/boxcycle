# 동행 비용과 표시 품질 재검토

| 항목 | 내용 |
|---|---|
| 최초 작성 | 2026-10-29 |
| 독자 | Chief · AI |
| 상태 | 표본시각·RTDB변경필드저감 Hosting 배포완료·운영자산검증 / 큰공백·Firestore저감 잔여 |
| 요청 | 소규모 테스트에서도 발생하는 비용과 동행 앞뒤 진동을 함께 줄일 방법 |
| 결과 | [01 분석·권고](01-analysis.md) |
| 동속 후속 | [02 프레임 회귀 가설·5km/h 재생](02-equal-speed-frame-investigation.md) — rAF8·residual9 PASS, 실화면 원인 미확정 |
| 공백 후속 | [03 수신 공백 재생](03-receive-gap-investigation.md) — 정상1PASS·진단2FAIL, 추가뒤처짐3.3/4.6m후복귀·현장원인미확정 |
| 해결 후속 | [04 해결 방향·로컬 수정](04-solution-and-local-fix.md) — 거리/시각짝수정·합성6→1.2cm·peer75/spacing/build PASS·큰공백은별도 |
| 비용 검토 | [05 품질보존 트래픽 저감 검토](05-quality-preserving-traffic-review.md) — 동일5Hz변경필드update 후보·FS위치fanout역할분리·절감률미확정 |
| 릴리스 | [06 배포 검증](06-release-verification.md) — 제품8101ead2·보고187ddf9c푸시·Hosting완료·전체1443/운영6자산PASS |
| 저감 구현 | [07 변경필드 전송 구현](07-traffic-reduction-implementation.md) — Codex직접·로컬TCP하향21.7%감소·동일상태·78f0dd19커밋/푸시자동승인차단 |
| 저감 배포 | [08 트래픽 저감 릴리스](08-traffic-release.md) — 명시승인후푸시·Hosting완료·전체1449/운영6자산PASS·Codex직접 |
| 선행 | [트래픽 후속](../20261002-public-trail-traffic-followup/README.md) · [동행 진동](../20261005-peer-spacing-jitter/README.md) |

조사와 오프라인 검증 및 후속요청에따른거리/시각짝결함수정은자율수행했다. Firestore/RTDB역할·장애시제품동작을바꾸는구현은Chief결정대상이다. 운영구조·전송주기·Rules는변경하지않았다. 과거묶음의CLOSED는당시검증범위이며이번관측의해결을뜻하지않는다.

검증 증거는 evidence의 이번 실행 JSON으로 보존한다. 실행 위치·복사 명령·미실행 항목은 결과 문서에 있다.
