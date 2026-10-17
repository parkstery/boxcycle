# 결과02 — HTML 사진 선요청

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 구현 결과 |
| 최초 작성 | 2026-10-17 |
| 상태 | DEVELOPMENT_DONE |
| 독자 | Supervisor · chief |
| 수행 | Developer — Cursor |
| 모델 | Composer (Auto, Cursor 에이전트 라우터) |
| 세션 | 이 실행 환경에 세션 식별자는 노출되지 않았다. 작업 시각은 2026-10-17 10:50(UTC+9) 이후 |
| 연결 문서 | [지시02](02-task-02.md) · [지시01](02-task-01.md) |

## 저장소

| 항목 | 값 |
|---|---|
| 브랜치 | `main2` |
| HEAD | `1f226f19ac465aef390998bd9ccc99b3e138abe3` |
| 이번 제품 변경 | `apps/web/index.html` 한 파일 |

작업 시작 시 이미 있던 다른 담당 변경은 그대로 두었다. 수정: `AGENTS.md`, `document/260707-RTW-결정-로그.md`, `document/archive/README.md`, `document/ops/PROGRESS.md`, `document/ops/README.md`, `document/reference/operations/261009-RTW-개발에이전트-협업-감리.md`. 미추적: `document/archive/reports/261017-RTW-프로세스&메모리-정리.md`, `document/ops/20261017-intro-preload/`. 지시·공용 색인은 고치지 않았다. commit, push, deploy, server, browser, subagent는 실행하지 않았다.

## 변경

`apps/web/index.html` head에 이미지 preload 링크 한 건과 짧은 한국어 주석을 넣었다. href의 `&amp;`는 파싱 후 `AppIntroScreen.tsx`의 `INTRO_SATELLITE_SRC`와 같은 URL이다.

`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=12.4865%2C41.8875%2C12.4979%2C41.8929&bboxSR=4326&imageSR=3857&size=1600%2C1000&format=jpg&f=image`

속성은 `rel="preload"`, `as="image"`, `fetchpriority="high"`, `referrerpolicy="no-referrer"`, 선택 속성 `type="image/jpeg"`이다. 기존 img에 crossorigin이 없어 preload에도 넣지 않았다. 이미지 preload는 이 한 건이다. 화면 문구, CSS, 인증 게이트, 지도 초기화, 앱 분리는 바꾸지 않았다.

빌드 산출 `apps/web/dist/index.html`에도 같은 링크가 head에 남는다. `apps/web/.gitignore` 11행 `dist`라 추적되지 않는다. 커밋하지 않는다.

## 검증

| 명령 | 종료 코드 |
|---|---|
| `npm.cmd --prefix apps/web run build` | 0 |
| `git diff --check -- apps/web/index.html` | 0 |

빌드는 `tsc -b && vite build`까지 끝났고, 출력은 `✓ built in 1.99s`이다. 같은 로그에 청크 500 kB 초과 안내와 `riderRig.ts`의 `SADDLE`·`PELVIS` import 경고가 있다. 이번 변경 파일은 `index.html`뿐이다. 빌드 후 `git status --porcelain -- apps/web`는 `M apps/web/index.html`만 보여 준다.

지시가 browser를 금지해, 앱 모듈을 지연시킨 뒤 이미지 요청이 먼저 시작되는지와 동일 img가 요청을 재사용하는지는 여기서 확인하지 않았다. 그 대조는 Supervisor 독립 검수 범위다.

## 한계

HTML이 항상 이 사진을 선요청하므로, 인트로가 생략되는 진입에도 배경 요청이 난다. 그 전송 비용과 외부 영상 서비스의 응답 지연은 남는다. 실기기·운영 속도가 개선됐다고 단정하지 않는다. 이미지 소스·저장 정책, 인증 의미, 아키텍처, 배포는 범위 밖이라 확장하지 않았다.
