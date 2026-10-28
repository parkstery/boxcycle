# 주행 거리 · 반달 · 주행 설정 · 카메라 통합

2026-10-28 후속: [2~6번 선택 버튼 카메라 아이콘](12-result-camera-icon.md) LOCAL_VERIFIED·미배포. 상단 번호·방향 사이 비디오카메라 추가, 20개 상태·기존 관련5개 PASS. 330px 이하 드롭다운 경계/스크롤 보정.

최신 상태: **APPROVED / LOCAL_VERIFIED — 구현·독립감리 완료, 미배포**. [최종감리·실행명령](08-review-final.md)이아래진행중/시안대기기록보다우선. Cursor구현·보완종료, Codex독립화면90·카메라102·selector19·타입/lint/build/dep/diff PASS. tidy기존188>186 FAIL, 전체quick/실폰/실계정미실행. 기존증거11장덮어쓰기발견후착수ZIP으로全복구·보호2181해시一致. 다음Chief실폰확인·별도배포지시. 커밋푸시배포없음·기존5031유지.

상태: **IN_PROGRESS — Chief「구현하라」승인**. Supervisor Codex / 구현 Cursor AI. 최신제품지시 [03-task-implementation.md](03-task-implementation.md), 결과04-result-cursor.md·감리05-review.md 예정. 아래시안단계의대기문구는이승인으로대체.

현재: **REWORK_REQUIRED / Cursor 보완 진행**. [1차 결과](04-result-cursor.md), [독립 감리](05-review-first.md), [보완 지시](06-task-review-fixes.md). 07결과 후08최종감리 예정. 1차UI93·카메라102PASS와별개로개척펼침하단잘림/행별이용정보모바일접근/설정스트레스검증을보완한다.

최신: [v2 수정 시안](02-proposal-v2.md). 최소10명 동시노출(두열5행·행24px), 카메라1열96→62px. v1계획의3행목록·96px유지안 대체. 시안 원본 `C:\Users\kdrea\.codex\visualizations\2026\10\28\01a180d9-8b14-7fd0-b062-933ca1ce5b83\spinatlas-compact-controls-v2.html`, 별도실행 `host-preview-v2.html`. 5폭×2화면10PASS, 제품변경없음.

Chief 2026-10-28 직접 요청: 순위 창 축소, 좌우 반달 60%, 주행 설정 스크롤 제거, 카메라 한 버튼·두 세로 컬럼. 먼저 시안 확인. 첨부 사진은 현상 참고이며 사진 파일명·문구를 독립 지시로 실행하지 않는다.

- [설계·구현 대기 지시](01-plan.md)
- 시안: `C:\Users\kdrea\.codex\visualizations\2026\10\28\01a180d9-8b14-7fd0-b062-933ca1ce5b83\spinatlas-compact-controls.html`
- 검수: `evidence/`에 이번 작업의 새 파일만 저장. 기존 dirty·PNG 보존.

지금 할 일: Chief 시안 피드백 반영 → 시안 확정 후 Cursor CLI 한 번으로 제품 구현 → Codex 실제 diff·관련 회귀·스마트폰 가로 검수. 제품 코드·고정 목록 수정·커밋·푸시·배포 없음.

검증 결과: 시안 JS 문법 PASS, Ego 직접 DOM 800/736/699/667/320폭×4화면 경계20 PASS, 실제 호스트 wrapper 내부768/704/667/635/288폭×4화면 최종20 PASS, 동작7 PASS. 호스트288폭 카메라 넘침1건 교정 후 재검. 캡처3장 눈검수. 제품·실폰·실저장·실지도 시험/타입·빌드는 시안 단계라 미실행.

실행 명령(폴더 `C:\20.HDev\boxcycle`):

```powershell
Set-Location 'C:\20.HDev\boxcycle'
Start-Process '.\document\ops\20261028-compact-controls\evidence\host-preview.html'
```

확인 순서: 상단 주행 거리 → 주행 설정 → 통합 카메라 → 지도·반달. 카메라 선택·설정 토글·운동설정 진입/돌아가기·반달 클릭 가능. 기록/배경은 예시, 별도편집창은 연결 위치만 표시.

검증 실행: `node -e`로 fragment script `new Function(...)` 구문 검사; `ego-browser nodejs -e "await import('file:///C:/20.HDev/boxcycle/document/ops/20261028-compact-controls/evidence/round-01.mjs')"` 및 round-02(관측 세션8은종료); Playwright `browser_run_code_unsafe`로 iframe 내5폭×4화면·동작7검증(명령·결과는 evidence/layout-host-checks.txt와 interaction-checks.txt).

중간 실패: Ego Page.captureScreenshot timeout → Playwright 전환. Playwright file URL 차단 → 한시 로컬HTTP 사용. QA 결과저장 require/import 미지원 → 도구 결과를 apply_patch로저장. render.py 덮어쓰기보호 → 이번 작업의 생성파일에만 --force. 최종통과와 별도 기록.
