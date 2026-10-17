# 검수02 — 인트로 배경 선요청

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 독립 검수 |
| 최초 작성 | 2026-10-17 |
| 상태 | APPROVED — 로컬 구현·검증 완료, Chief 확인 대기 |
| 독자 | chief · AI |
| 담당 | Supervisor Codex |
| 연결 문서 | [지시02](02-task-02.md) · [결과02](03-result-02.md) |

## 변경 검수

제품 diff는 `apps/web/index.html`에 추가한 주석·preload 링크 9행뿐이다. 사진 URL·원본 크기·온라인 제공 정책은 동일하다. referrerpolicy=no-referrer 및 crossorigin 없음이 기존 img와 일치한다. 인증·지도·문구·CSS 변경은 없다. 빌드 HTML에서도 preload가 앱 모듈 script보다 앞에 남는다.

Chief 최신 지시도 별도로 반영했다. 기본 구현 도구는 Cursor AI·CLI이며 OpenCode는 Chief가 명시 요청할 때만 GLM-5.3을 사용하고, 불가 시 Cursor로 돌아온다. 안내·질의·권한 요청은 한국어로 작성한다. AGENTS, 협업 계약, ops 입구와 결정 로그를 갱신했다. 과거 Muse 사용 이력은 보존했다.

## 실제 검증

| 실행·확인 | 종료 코드 | 결과 |
|---|---|---|
| Developer `npm.cmd --prefix apps/web run build` | 0 | tsc·Vite 빌드 통과. 결과02와 새 dist HTML 확인 |
| Supervisor `git diff --check -- apps/web/index.html` 및 변경 지침·색인 파일 공백 검사 | 0 | 통과. Git의 기존 CRLF 안내 있음 |
| Supervisor 임시 명령 `PowerShell here-string → node`로 원본·빌드 HTML과 컴포넌트 URL·정책·태그 순서 비교 | 0 | 두 HTML 모두 preload 1건, 주소·정책 일치, 앱 모듈 앞 배치 |
| Supervisor 임시 명령 `PowerShell here-string → node`의 Playwright 비교 검증 | 0 | 아래 요청 선행·재사용 검증 통과 |
| `node scripts/check-document-system.mjs` | 0 | 205파일, 깨진 링크·새 오류·구조 오류 각 0 |
| Cursor 구현 실행 | 0 | 한국어 결과02 작성 후 종료. 실제 모델은 Composer/Auto로 보고, 세션 ID 미노출 |

브라우저는 headless Chromium 한 개, context/page를 순차 생성했고 740×300에서 확인했다. 실제 원본 index.html을 사용하며 변경 전 조건은 이미지 preload 태그만 제거했다. 앱 모듈 응답을 보류한 동안 사진 요청 건수를 세고, 모듈 해제 후 기존 컴포넌트와 동일한 URL·referrerPolicy·fetchPriority·loading 속성의 img를 삽입했다. 사진은 기존 검수 원본 `intro-76-satellite.jpg`를 fixture 응답으로 사용했고, 실제 서비스와 같은 `Cache-Control: max-age=0,must-revalidate`를 부여했다. 외부 통신·Firebase 인증·실제 App 실행 없이 브라우저의 HTML 탐색과 preload 재사용 동작을 분리 검증한 것이다.

| 조건 | 앱 모듈 실행 전 사진 요청 | 사진 표시 후 총 요청 | 참조 정보 전송 | 원본 가로 픽셀 |
|---|---:|---:|---|---:|
| 변경 전 | 0 | 1 | 없음 | 1600 |
| 변경 후 | 1 | 1 | 없음 | 1600 |

첫 시도의 한국어 식별자가 PowerShell→node 파이프 인코딩 때문에 손상되어 구문 오류(exit1)가 났다. 파일 변경 없이 임시 명령을 ASCII 식별자로 고쳐 재실행했고 위 비교가 통과(exit0)했다. 실패를 제품 문제나 성공으로 기록하지 않는다. 새 시험·진단 스크립트 파일은 만들지 않았다.

## 한계·인계

사진 요청 시작을 앞당긴 변경이다. 외부 서비스의 첫 응답 대기 자체는 남으며, 몇 초 빨라졌다는 운영 수치는 측정하지 않았다. preload가 HTML에 상시 있으므로 인트로가 생략되는 진입에도 사진 요청 비용이 발생할 수 있다. 스마트폰 실기기·실제 서비스 응답을 포함한 종단 간 속도는 미검증이다. 화면 배치는 바꾸지 않아 별도 디자인 재검증은 하지 않았다.

사용자 소유 archive 색인·프로세스/메모리 보고 변경 보존. 커밋·푸시·배포 없음. 로컬 수정과 검증을 완료했으며 운영 반영은 별도다.
