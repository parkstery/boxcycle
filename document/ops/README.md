2026-10-21 [지도 중심 UI 릴리스07](20261020-ui-800x360/05-release-07.md): DEPLOYED/Chief실기기검수대기. main2 ae646df9·Hosting성공·운영4파일일치. 주소단일면24px/두행85px/5행157px·비노출에지·상단계기. web1319/브라우저14+최종실지도1 PASS. https://boxcycle-dc2df.web.app

2026-10-20 [신규 도로 릴리스](20261020-new-road-display/02-task-02-release.md): IN_PROGRESS. Chief커밋·푸시·병합·배포승인. 날짜형식/긴선분/새기록삭제경로보완, Functions132·Rules실제에뮬레이터PASS. 분리소스빌드·main2병합·선택배포진행.

2026-10-20 [신규 도로 표시 복구](20261020-new-road-display/04-review-01.md): LOCAL_VERIFIED/Chief 실제계정확인대기. 종료시빈서버값덮어쓰기·positive미반영·최근범위이동누락교정, 기존취득일+trace복원. Node94/React시트1(2폭)/build/lint오류0·기존40경고/diff PASS. localhost5000강력새로고침, 배포·커밋·푸시없음.

2026-10-19 [Guest·위치·Ready Ride 배포26](20261019-guest-lifecycle/04-review-26-release.md): DEPLOYED/Chief사용확인대기. main2 d22c0492원격반영·Functions12/Rules/Hosting성공. web1295/서버127/독립32 PASS,운영인트로·API204/401·Google4/문서2227보존. 매일03:15KST Guest정리활성. https://boxcycle-dc2df.web.app

2026-10-15 진행79: 콜로세움 약간 오른쪽 프레이밍, 카메라 서쪽으로 0.0017도 이동/zoom15 유지. 지시 document/ops/20261013-face-redesign2/02-task-79.md.

2026-10-15 최신78: 실제 첫 지도 로마콜로세움주변zoom15·명시지역우선 6a1d5e6 커밋·APPROVED/Chief화면확인대기. 검수 document/ops/20261013-face-redesign2/04-review-78.md. 공개정사영상도로구도·실Mapbox엔진5경우/marker0/geo0/자유이동·회귀6·타입/lint/selector18/build PASS. 서울실데이터유지,실타일/실기기미검증,push/배포없음.

2026-10-15 최신77: 인증대기를연결실패로오표시하던UI버그교정 f20450a 커밋·APPROVED/Chief확인대기. 검수 document/ops/20261013-face-redesign2/04-review-77.md. 수정전busy/error없음실패재현, 수정후실App fixture8전환·React렌더4·selector18·타입/lint/build·수집105 PASS. 실제OAuth/실주행미검증,push/배포없음.

2026-10-15 최신: 교정76 콜로세움 수직 위성영상 dbab829 커밋·APPROVED/Chief확인대기.74지도위치방식·75조감도영상대체. 검수 document/ops/20261013-face-redesign2/04-review-76.md. 공개원본직접확인·브라우저5크기fixture/CTA/실패시서울차단·타입/lint/selector17/build PASS.5014,온라인영상,push/배포없음.

2026-10-15 교정75 진행: Chief 요구는 실제 콜로세움 지역 사진 배경. 74 지도카메라 방식은 요구 오해로 대체. 로컬 사진 고정·직접 캡처 검수, 지시 document/ops/20261013-face-redesign2/02-task-75.md.

2026-10-15 최신: 인트로74 로마 콜로세움 위성 배경 d4d7ec0 커밋·APPROVED/Chief확인대기. 검수 document/ops/20261013-face-redesign2/04-review-74.md. 5폭Mapbox투영·실앱위성/CTA/로그아웃·타입/lint/selector17/build PASS. 실지도외관·실기기미검증,5014유지,push/배포없음.

2026-10-15 최신: 지도 배경 앱 인트로72·E2E진입보정73 1f5f14d 커밋·APPROVED/Chief확인대기. 검수: document/ops/20261013-face-redesign2/04-review-73.md. 6화면·실앱9·helper10·selector17·수집105·타입/lint/build PASS. 로컬main2/5014, 실지도·실기기미검증, push/배포없음.

# ops — 에이전트 작업 창구

2026-10-20 [UI 이전 수정 릴리스](20261020-pre-ui-release/README.md): IN_PROGRESS. Chief 커밋·푸시·병합·배포 승인. 미니맵·브랜드표기·시험lint와 기존 프로필/메뉴/신규도로 커밋, 새800×360 UI제외. 분리소스 검증·배포.

2026-10-17 첫 진입 인증·위치 호스팅 배포: main2 5cb0679, https://boxcycle-dc2df.web.app. 권한별·폰 검수는 아직.

2026-10-17 [첫 진입 인증·위치 통합](20261017-entry-location/README.md): IN_PROGRESS. Chief 승인, 인트로 게스트/로그인→지구본→위치 권한별 현재 위치/콜로세움. 이전 2초 자동 전환 대체. Cursor 구현·Codex 검수, 배포 없음.

2026-10-17 [인트로 자동 전환](20261017-intro-auto-transition/README.md): SUPERSEDED. 최신 [첫 진입 인증·위치 통합](20261017-entry-location/README.md)으로 대체. 2초 타이머는 채택하지 않고 당시 구현·검증 기록만 보존한다.

2026-10-17 [인트로 배경 선요청](20261017-intro-preload/README.md): APPROVED/Chief 확인 대기. Cursor 구현·Supervisor 검수: 빌드·원본/빌드 URL 대조·브라우저 선요청/총1건 재사용·문서검사 통과. 기본 Cursor/한국어 지침 반영. 배포 없음.

2026-10-15 최신창:41 Chief통과,결과42/43 [감리43](20261013-face-redesign2/04-review-43.md) APPROVED/Chief확인대기。CSS余白/테두리/단위대비·보조수치wrap,지도없는browser1/page1순차8상태PASS,face-redesign2/5013유지。

2026-10-15 최신창:40 Chief통과,센서41 [감리41](20261013-face-redesign2/04-review-41.md) APPROVED/Chief확인대기。체험선택표시/강조/余白정리,単一browser/page順次검수,face-redesign2/5013유지。

2026-10-15 최신창: 콤팩트캐럿40 [감리40](20261013-face-redesign2/04-review-40.md) APPROVED/Chief확인대기.왼쪽정렬·44→24px·여백0,CSS4선만·DOM48/실제15 PASS,face-redesign2/5013유지。

2026-10-14 최신창: 이중캐럿/위아래동반패널38/39 [최종감리39](20261013-face-redesign2/04-review-39.md) APPROVED/Chief확인대기.텍스트모드button제거·위치위/거리아래펼침/접기·값보존.48DOM+실제15·141테스트 PASS,face-redesign2/5013유지.

2026-10-14 최신창: 위치/거리모드別화면34~37 [최종감리37](20261013-face-redesign2/04-review-37.md) APPROVED/Chief확인대기. 두중간토글제거·거리›진입/‹위치선택복귀·공통삭제.32DOM+실제15상태·141테스트 PASS,face-redesign2/5013유지. 이전33디자인미채택.

2026-10-14 최신창: 경로 탐색 모드별접기30~33 [최종감리33](20261013-face-redesign2/04-review-33.md) APPROVED/Chief확인대기. 두패널한행토글44px·값보존·펼침후배치·내부스크롤해소. face-redesign2/5013유지.

2026-10-14 최신창: 경로생성 [감리29](20261013-face-redesign2/04-review-29.md) APPROVED·Chief확인대기.입문28 Chief통과,face-redesign2/5013유지.

2026-10-14 최신창: 입문행간추가축소 [감리28](20261013-face-redesign2/04-review-28.md) APPROVED·Chief확인대기. face-redesign2/5013유지.

2026-10-14 최신창: 입문 [감리27](20261013-face-redesign2/04-review-27.md) APPROVED·Chief확인대기.두목록26 Chief통과,face-redesign2/5013유지.

2026-10-14 최신: face-redesign2 두목록추가밀도 [감리26](20261013-face-redesign2/04-review-26.md) APPROVED·Chief확인대기.5013유지.

2026-10-14 최신창: 내경로/퍼블릭줄간격·행밀도 [감리25](20261013-face-redesign2/04-review-25.md) APPROVED·Chief확인대기. face-redesign2/5013유지.

2026-10-14 최신창: 내경로22 Chief통과,퍼블릭23/24 [감리24](20261013-face-redesign2/04-review-24.md) APPROVED·Chief확인대기. face-redesign2/5013유지.

2026-10-14 최신창: 계정20 Chief통과,내경로21/22 [감리22](20261013-face-redesign2/04-review-22.md) APPROVED·Chief확인대기。face-redesign2/5013유지。

2026-10-14 최신창: face-redesign2 계정compact2컬럼 [감리20](20261013-face-redesign2/04-review-20.md) APPROVED·Chief확인대기. 5013유지,계정19단열대체.

2026-10-14 최신창: 메뉴18 Chief승인, 계정19 [감리19](20261013-face-redesign2/04-review-19.md) APPROVED·Chief확인대기. face-redesign2/5013 유지, 다음창피드백후.

2026-10-14 메뉴 한 창 완료: face-redesign2 [감리18](20261013-face-redesign2/04-review-18.md) APPROVED, Chief 확인 대기. Muse 구현·Supervisor 독립 검수, 5013 실행 중. 다음 창은 피드백 후.

2026-10-14: face-redesign2 [UI 균형 수정안17](20261013-face-redesign2/17-proposal-ui-balance.md) 추가. Chief 검토 후보, 구현 전. 기존 묶음에 이어 기록한다.

| 항목 | 내용 |
|------|------|
| 문서 유형 | **메타** — `ops/` 묶음 색인. 폴더마다 한 줄 |
| 독자 | **chief** · AI |
| 최초 작성 | 2026-09-28 |
| 상태 | **SoT** — 묶음을 열거나 닫을 때 이 표를 함께 고친다 |
| 연결 문서 | [현황판](../260928-RTW-현황판.md) · [문서 지침 §8.4](../260509-BOXCYCLE-문서-생성-및-수정-지침.md) |

> `ops/` 는 Supervisor(Codex) ↔ Developer(Cursor AI·CLI 기본)의 공식 파일 기반 업무 창구다. OpenCode는 Chief가 명시 요청할 때만 GLM-5.3으로 사용하며 불가 시 Cursor로 돌아온다. 기존 릴레이 기록도 보존한다.
> chief 는 [전체 상태판](PROGRESS.md)과 아래 묶음 표로 현재 상황을 확인한다. 폴더 안의 지시서·보고서는 에이전트용이다.

## 역할과 handoff

1. **Chief**: 요구와 제품 방향을 전달하고 중요한 결정·최종 완료를 승인한다. AI 사이의 파일을 복사해 전달하지 않는다.
2. **Supervisor (Codex)**: 요구를 분석해 범위, 완료 조건, 검증 방법, 승인 필요 여부를 지시에 적고 상태를 `READY_FOR_DEVELOPMENT`로 둔다.
3. **Developer (기본 Cursor AI·CLI / 명시 요청 시에만 OpenCode GLM-5.3)**: 지정된 지시 파일을 읽고 그 범위만 수행한다. 실제 변경 파일, 실행한 검증과 결과, 실패·미완·범위 밖 발견을 별도 결과 파일에 적는다. 승인 대상이 발견되면 구현을 멈추고 `BLOCKED`로 보고한다.
4. **Supervisor**: 결과 문서뿐 아니라 Git diff와 검증 근거를 확인한다. 합격이면 `APPROVED`, 부족하면 이유와 완료 조건을 별도 재지시 파일에 기록해 `REWORK_REQUIRED`로 둔다. 완료 보고는 Chief에게 직접 한다.

이 역할은 **새 작업의 기본값**이다. 기존 Claude 묶음의 파일명·도메인 규율·증거는 해당 기록을 읽을 때 그대로 유효하다. 종료된 묶음에 남은 자동 대기 명령은 재가동을 뜻하지 않는다.

## 새 작업 묶음

`YYYYMMDD-주제/`를 만들고 `README.md`에 목적, 현재 상태, 최신 지시·결과·검수 링크와 다음 행동을 적는다. 규모에 맞춰 `00-brief.md`, `01-plan.md`, `02-task-01.md`, `03-result-01.md`, `04-review-01.md` 등을 **필요한 만큼만** 만든다. 기존 묶음의 이름은 바꾸지 않는다. 작업 지시는 담당자, 허용·금지 범위, 완료 조건, 검증 명령, 보고 경로, Chief 승인 조건을 명시한다. 지시와 결과와 검수는 서로 다른 파일로 남기고, 재작업은 다음 번호의 파일로 이어 이전 기록을 덮어쓰지 않는다. 일반 작업은 묶음의 최종 결과만 남긴다. 별도 완료 보고서가 필요한 작업은 [문서 지침 §8](../260509-BOXCYCLE-문서-생성-및-수정-지침.md)에 따라 `document/archive/reports/`에 한 편 작성한다. 작업 지시에 [02-rules §8](20261017-dev-byproducts/02-rules.md) 문장을 넣는다.

## 상태와 승인

`PLANNING` → `READY_FOR_DEVELOPMENT` → `IN_PROGRESS` → `DEVELOPMENT_DONE` → `UNDER_REVIEW` → `APPROVED` → `CLOSED`가 보통 흐름이다. 결정 대기는 `AWAITING_CHIEF`, 재작업은 `REWORK_REQUIRED`, 진행 불가는 `BLOCKED`를 쓴다. 모든 단계를 기계적으로 거칠 필요는 없다. [PROGRESS.md](PROGRESS.md)는 현재 작업·담당·단계·Chief 승인 여부·마지막 검수·막힘·다음 일을 보여주는 상태판이며, 상세 이력은 작업 폴더에 둔다.

Supervisor는 아키텍처, 도메인 경계, 데이터 모델, Firestore·RTDB·Firebase Rules, 외부 API, 의미 있는 비용, Public Trail 동기화 구조, 기존 공용 인터페이스, 대규모 이동, 기존 기능 의미, 요구 해석 또는 작업 범위의 큰 변경을 **구현 전에** Chief에게 올린다. 일반 작업의 사소한 판단은 Supervisor가 처리한다.

## 실행·Git

2026-10-17 Chief 변경: 기본 실행은 Cursor이다. 아래 과거 Muse·교대 표현보다 이 지시가 우선하며, 새 지시당 기본 Cursor 실행 한 번을 사용한다. OpenCode는 명시 요청 시에만 GLM-5.3으로 사용한다.

새 지시 한 건마다 기본 Cursor 실행 한 번으로 제한한다. 모델·교대·모바일 검수는 [협업·감리 계약](../reference/operations/261009-RTW-개발에이전트-협업-감리.md)을 따른다. `agent -p --workspace C:\20.HDev\boxcycle "document/ops/<묶음>/<지시파일>을 읽고 지시된 범위만 수행한 뒤 결과 파일을 작성하라"` 형태로 실행하고 종료 코드와 출력을 확인한다. 실제 옵션은 로컬 `agent --help`에서 확인한다. 무한 대기 릴레이는 기본 실행 방식이 아니다. Git 브랜치·커밋·푸시는 [개발 워크플로](../reference/operations/260719-개발-워크플로-브랜치-커밋-게이트.md)와 해당 작업 지시의 제한을 따른다. 다른 작업의 변경은 섞지 않는다.

## 규칙 (요약)

1. 새 묶음은 `YYYYMMDD-주제/` 로 열고 폴더 `README.md` 에 「지금 할 일」을 둔다. 이 표에 한 줄 추가.
2. 종료가 확정되면 현재 표와 PROGRESS에서 빼고 [종료 색인](../archive/README.md)에 결과와 위치를 남긴다. APPROVED는 CLOSED와 다르다. 종료 시 [02-rules §6](20261017-dev-byproducts/02-rules.md) 정리.
3. 종료된 폴더는 **코드·스킬·명령이 그 경로를 가리키지 않을 때만** `archive/ops/` 로 옮긴다. 가리키면 제자리에 둔다.

## 진행·대기 묶음 (2026-10-09)

| 폴더 | 상태 | 무엇 | 결과·입구 | 이동 |
|---|---|---|---|---|
| [20261013-face-redesign2](20261013-face-redesign2/README.md) | **APPROVED** · 로컬main2 통합 | 디자인수정 완료·병합83079c3·quick1066 PASS | [검수65](20261013-face-redesign2/04-review-65.md) | 실기기/실인증/실주행 검증 별도 |
| [20261009-mobile-design-collaboration](20261009-mobile-design-collaboration/README.md) | **AWAITING_CHIEF** · 확장 05 · 준비·센서 패널 | 스마트폰 우선 디자인·Muse / Cursor 협업 체계, 코드 작성 금지 | [디자인 초안](20261009-mobile-design-collaboration/17-design-preparation-sensor.md) · [인계 검수](20261009-mobile-design-collaboration/04-review-01.md) | — |
| [20261008-pacer-riders](20261008-pacer-riders/README.md) | **APPROVED** · main2 병합·배포 | 혼자 주행 시 로컬 페이서 2명(±20m 추월, 기본 켜짐) | [계획](20261008-pacer-riders/01-plan.md) · [검수 01](20261008-pacer-riders/04-review-01.md) | — |
| [20261007-lint-baseline-react-hooks](20261007-lint-baseline-react-hooks/README.md) | **APPROVED** · 커밋 완료 | 기존 lint 오류 15파일 36건 제거(의미 보존) | [검수 01](20261007-lint-baseline-react-hooks/04-review-01.md) | — |
| [20261006-account-deletion](20261006-account-deletion/README.md) | **APPROVED** · 배포 대기 | 계정 탈퇴 기능 | [계획](20261006-account-deletion/01-plan.md) · [검수 15](20261006-account-deletion/04-review-15.md) | — |
| [20261006-rider-missing](20261006-rider-missing/README.md) | **CLOSED** · 서버 중지 탓(Chief 확인) | 주행 중 3D 라이더 사라짐 | [기록](20261006-rider-missing/README.md) | — |
| [20261006-resume-finish-discard](20261006-resume-finish-discard/README.md) | **APPROVED** · 커밋 완료 | 이어 달리기 마지막 구간 완주가 짧은 주행 폐기에 막힘 | [검수 13](20261006-resume-finish-discard/04-review-13.md) | — |
| [20261006-bottom-right-stack](20261006-bottom-right-stack/README.md) | **APPROVED** · 커밋 완료 | 우하단 시계·다음 주행 카드·고도/축척 고정 | [검수 12-2](20261006-bottom-right-stack/04-review-12b.md) | — |
| [20261006-camera1-presets](20261006-camera1-presets/README.md) | **DEVELOPMENT_DONE** · Cursor · 검수 대기 | 카메라 1번 경로전체/500m/20m · 위성 기본 | [지시 11](20261006-camera1-presets/02-task-11.md) · [결과 11](20261006-camera1-presets/03-result-11.md) | — |
| [20261006-ride-end-north-up](20261006-ride-end-north-up/README.md) | **APPROVED** · 커밋 완료 | 주행 종료 시 지도 정북 복귀 | [검수 10](20261006-ride-end-north-up/04-review-10.md) | — |
| [20261006-ride-summary-layout](20261006-ride-summary-layout/README.md) | **APPROVED** · 커밋 완료 | 주행 결과 히어로 정리·✕ 닫기 | [검수 09-2](20261006-ride-summary-layout/04-review-09b.md) | — |
| [20261006-lint-baseline-saved-routes](20261006-lint-baseline-saved-routes/README.md) | **APPROVED** · 커밋 완료 | pre-commit 막는 기존 lint 오류 제거 | [검수 08](20261006-lint-baseline-saved-routes/04-review-08.md) | — |
| [20261006-minimap-dock-overlap](20261006-minimap-dock-overlap/README.md) | **APPROVED** · 커밋 완료 | PC 에서 미니맵·RouteDock 겹침 | [검수 07](20261006-minimap-dock-overlap/04-review-07.md) | — |
| [20261006-hud-clock-map-controls](20261006-hud-clock-map-controls/README.md) | **DEVELOPMENT_DONE** · Cursor · 검수 대기 | 시계 HUD 우하단·맵 상시 + Mapbox 제자리·카드 비킴(06-4) | [지시 06-4](20261006-hud-clock-map-controls/02-task-06d.md) · [결과 06d](20261006-hud-clock-map-controls/03-result-06d.md) | — |
| [20261006-saved-route-integrity](20261006-saved-route-integrity/README.md) | **APPROVED** · 커밋 완료, functions 배포 대기(Chief) | 퍼블릭 신청 지문 오거절·「내 경로로 저장」 미완주 기록·이어달리기 대상 교체 | [지시 03](20261006-saved-route-integrity/02-task-03.md) · [지시 04](20261006-saved-route-integrity/02-task-04.md) | — |
| [20261006-route-modal-public-badge](20261006-route-modal-public-badge/README.md) | **APPROVED** · 미커밋 | 경로 선택 창 — Public 배지·등록자 우측·공개 시 창 전환 | [검수 01](20261006-route-modal-public-badge/04-review-01.md) · [검수 02](20261006-route-modal-public-badge/04-review-02.md) | — |
| [20261006-calories-resume](20261006-calories-resume/README.md) | **APPROVED** · origin/main2 반영 완료 | 칼로리 계산 변경·단일 재개 대상 유지 | [18 검수](20261006-calories-resume/18-review-supervisor.md) · [24 push 완료](20261006-calories-resume/24-result-remote-push.md) | 사용 확인·종료 대기 |
| [20261006-saved-route-readability](20261006-saved-route-readability/README.md) | **APPROVED** · origin/main2 반영 완료 | Edge 내 경로 글자 가독성 | [03 검수](20261006-saved-route-readability/03-review.md) | 사용 확인·종료 대기 |
| [20261005-ride-map-controls](20261005-ride-map-controls/README.md) | **APPROVED** · origin/main2 반영 완료 | 카메라 아래 맵 제어·축척 왼쪽 고도 | [09 고도 검수](20261005-ride-map-controls/09-review-camera-altitude.md) | Chief 사용 확인·종료 대기 |
| [20261005-product-value-name-calories](20261005-product-value-name-calories/README.md) | **AWAITING_CHIEF** · 조사 문서 local 커밋 | 제품 동기·새 이름·칼로리 근거 조사와 제안 | [02 조사·제안](20261005-product-value-name-calories/02-result-and-proposal.md) | 제품 변경 미실시 |
| [20261005-document-system](20261005-document-system/README.md) | **APPROVED** · origin/main2 반영 완료 | 문서 체계 정리·상태보드 입구 유지 | [03 검수](20261005-document-system/03-review-document-system.md) | Chief 종료 승인 전 |
| [20261003-focus-read-spike](20261003-focus-read-spike/README.md) | **APPROVED** — main2 FF 완료(로컬) | 앱 foreground 복귀만으로 발생하는 Firestore read spike 조사·저감 | [21 최종 승인](20261003-focus-read-spike/21-review-final-approval.md) · [23 통합 결과](20261003-focus-read-spike/23-result-merge-main2.md) | — |
| [20261002-public-trail-traffic-followup](20261002-public-trail-traffic-followup/README.md) | **AWAITING_CHIEF** — 측정 도구 검수 완료, 운영 데이터 Ø | Public Trail 트래픽 후속 — phase-aligned 측정 준비 | [08 재작업](20261002-public-trail-traffic-followup/08-result-phase-aligned-measurement-rework.md) · [09 검수 PASS](20261002-public-trail-traffic-followup/09-review-phase-aligned-measurement-rework.md) | — |
| [sync-relay](sync-relay/INSTRUCTION.md) | **대기** | 동행 위치 동기화. 활성 지시 없음, S4-4(동행 튐) 재개 보류 | 후속 계획: [동행 지연과 경쟁 판정](20260927-peer-competition/260927-RTW-동행-지연과-경쟁-판정.md) | 불가 — `apps/web/scripts/peer-sync`·e2e·`/싱크지시` 가 경로 사용 |
| [20260923-minimap](20260923-minimap/HANDOFF.md) | **대기** | 미니맵·HUD 재배치. 지시04까지 병합 후 중단 | 보류01(배경에 실제 지도) 완료 2026-10-07. 남은 일: 보류02 | 가능(종료 시) |
| [20260927-peer-competition](20260927-peer-competition/README.md) | **대기** · PLANNING | 경쟁 판정 분리·느낌 보정의 기존 미착수 계획 | [계획](20260927-peer-competition/260927-RTW-동행-지연과-경쟁-판정.md) | 재개 시 새 지시 |

종료 작업과 옛 relay 이력은 [완료 기록 색인](../archive/README.md)에 있다. 코드·시험·스킬이 경로를 사용하는 종료 묶음은 제자리에 보존하지만 현재 작업으로 표시하지 않는다.

