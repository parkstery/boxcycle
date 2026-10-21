# 800×360 모바일 UI 개선

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — UI 개선 지시·결과·감리 |
| 최초 작성 | 2026-10-20 |
| 상태 | LOCAL_VERIFIED — 후속09~10 UI20·실지도2 PASS, 릴리스 진행. 기존08 배포 유지 |
| 독자 | chief · AI |
| 연결 문서 | [협업 계약](../../reference/operations/261009-RTW-개발에이전트-협업-감리.md) · [공간 밀도](../../reference/product/260924-RTW-UI-공간밀도-원칙.md) |

Chief 요청: 앞선 UI 분석을 토대로 800×360 CSS viewport에서 OpenCode GLM-5.3-Flash → Cursor AI 순서로 수정한다. 과거 조사 단계 코드 금지는 이번 명시적 구현 승인으로 해소되었다. 2026-10-21 지시07에서 Chief가 스마트폰 테스트를 위해 커밋·푸시·Hosting 배포를 명시 승인했다. 운영 데이터 수정은 범위 밖.

Supervisor Codex. 기존 main2 dirty 및 미니맵/신규 도로 작업 보존. 제품 쓰기 담당은 한 번에 한 명. 기존 세션에 입력하지 않는다.

1. [지시01](02-task-01.md): GLM-5.3-Flash — 계기판·주행 제어·센서.
2. 지시02: Cursor AI — 진입·지도 조작 중복·경로 선택·설정·계정 빈 상태·공통 시각 규격.
3. Supervisor: 실제 diff 검수, 800×360 대표 상태 캡처·충돌/잘림·터치 크기, 667×300·844×390 회귀, selector19·타입·lint·build·관련 시험. 실기기/실센서와 에뮬레이션 구분.

현재: GLM [결과01](03-result-01.md) 후 [감리01](04-review-01.md) REWORK_REQUIRED. Chief 우선순위에 따라 이전수정 릴리스 완료(코드5f012a52/문서8706ae91, Hosting·Rules·함수4성공). Cursor [지시03](02-task-03.md)·[지시04](02-task-04.md)로 지시02미완+좌우가장자리드래그를 구현하고 [감리04](04-review-04.md) LOCAL_VERIFIED 판정했다. 기준시작 HEAD `6cd54e27db9461e8fbfdee7fcc2541ce30af5201`, 현재 branch `main2`. 기존 소스 사본·해시는 `.out/ui-800x360/baseline`에 기록했다. [디자인 진단](01-design-direction.md).

결과 `03-result-NN.md`, 검수 `04-review-NN.md`. 완료 시 LOCAL_VERIFIED / Chief 화면 확인 대기 및 미실행 검증 명시.

직접 실행:
```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```
http://localhost:5000 — 브라우저 800×360, 강력 새로고침.

과거 검증 기록: [결과04](03-result-04.md) · [감리04](04-review-04.md). 당시에는 UI 커밋·푸시·배포와 실기기 검증을 하지 않았다. 현재 배포 상태는 아래 릴리스07을 따른다.

2026-10-21 Chief 반려: 노출된 흰색 에지 버튼·파란 막대, 중복 SPINATLAS/맵 트리거, 계기판 두 번째 행 배치, 과도하게 큰 주행·주소 패널은 의도에 반한다. [지시05](02-task-05.md)로 비노출 에지 스와이프, 계기판 최상단 복귀, 지도 가림 최소화·도크 압축을 재작업한다. 과거 감리04의 자동시험 PASS는 시각적 채택을 의미하지 않는다.

최신: [지시07](02-task-07.md)→[결과07](03-result-07.md)→[감리07](04-review-07.md). 도크두주소175×85·경유지최대5행157px·내부스크롤/중첩카드없음. 브라우저14PASS+최종실지도1PASS. 웹마우스·터치스와이프동일지원. 배포후실기기Chief검수대기.

[릴리스07](05-release-07.md): main2 커밋·푸시·Hosting 배포 완료. 운영 HTML/JS/CSS 4파일 SHA-256 일치, 800×360 인트로 확인. https://boxcycle-dc2df.web.app

후속 [지시08](02-task-08.md)→[결과08](03-result-08.md)→[감리08](04-review-08.md): Chief가 지정한 Mapbox 지구본·나침반 상시 툴 제거. DEPLOYED, main2 4aae5ed9·단위1321PASS·운영4파일일치·운영800×360 DOM검사PASS. 하단 축척/고도·로고/저작권 유지. https://boxcycle-dc2df.web.app

2026-10-21 현재 Chief가 경로생성 두방법분리·주소보기전용·우하단센서+주행바 제안을구현승인. [지시09](02-task-09.md) DeepSeek v4.1 Flash → [지시10](02-task-10.md) GLM5.3 Flash 순차단일writer, Supervisor독립검수. 느림/품질미달이면Cursor/Codex교대승인. 서버/DB/인증/운동정책불변. 기존08배포상태와 신규09~10진행을구별한다.

현재09~10: OpenCode두모델조사지연중단→Cursor09구현완료·Codex10직접구현/통합. [결과10](03-result-10.md)·[감리10](04-review-10.md).주소170×54·바163×34로준비fixture총가림면적5.113%,UI20PASS·실지도2PASS,릴리스진행. 09/10허용파일을분리한병렬투입이었으며같은파일writer중복없음.
