# 감리03 — 상단 브랜드·곡선 로고·인증 후 컨트롤

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — Supervisor 독립 검수 |
| 최초 작성 | 2026-10-18 |
| 상태 | APPROVED — 로컬 검증 완료 / Chief 화면 확인 대기 |
| 독자 | chief · AI |
| 연결 문서 | [지시03](02-task-03.md) · [실행03a](02-task-03a.md) · [결과03](03-result-03.md) |

## 결과·담당

SPINATLAS와 빨간원/검은곡선 SVG를 section 직속 좌상단으로 옮겼다. 로고만1.1초1회 회전 후 정지, reduced-motion에서는 정지한다. 본문/카피/게스트·로그인 콜백은 유지했다. MapHud의 optional visible(default true)을 모든 hooks 뒤에서 판정하고, App의 두 mapHud 경로에 `authInitialized && Boolean(user)`를 전달하여 인증대기/user없음/로그아웃에는 HUD DOM과 키보드탭을 제거한다. pre-auth root class는 지도 자체 컨트롤도 숨기되 Mapbox 출처 링크는 유지한다.

LongCat은 HTTP500 두 번 실패하여 사용LIMIT으로 오인하지 않았다. Chief가 Cursor 전환 및 지정4파일 패치/지시서 전달을 명시 승인한 뒤 Cursor AI Auto 세션 `c1956b59-f440-4391-b97e-6f53cc227480`가 Supervisor의 [패치](03-proposed.patch)를 적용·검증·결과 작성했다. 초기 자동승인검토의 외부소스전달 거부는 Chief의 구체승인 후 해소되었다. 환경파일·키·인증정보는 전달 대상에서 제외했다. 커밋·push·배포 없음.

## 독립 검증

- 실제 앱 667×275,740×300,1366×768에서 역할기반 버튼은 **게스트로 시작/로그인 두 개**. HUD DOM 없음·가로overflow없음·44px CTA 화면내. 폰 브랜드 top12/bottom40, PC top28/bottom70으로 본문과 겹침 없음. [수치](evidence/refine-geometry.json), [PC](evidence/refine-final-1366.png), [폰](evidence/refine-final-667.png).
- 원본 MapHud fixture에서 같은 mount의 `visible`을 인증복원대기→인증전→익명Guest→회원→로그아웃 순으로 바꿔 맵버튼 count0→0→1→1→0, 인증후 클릭콜백2회 PASS. App의 실제 바인딩2곳도 소스로 확인. [상태전환](evidence/refine-auth.json). 실제 OAuth/게스트서버인증을 실행한 것은 아니며 가짜 user를 원본컴포넌트에 주입한 표시정책 검증이다.
- 실제앱 reduced-motion에서 SVG animation none PASS, 기본animation명 spinatlas-mark-turn·1.1초/1회 CSS 확인. 워드마크에는 animation 없음.
- Supervisor 독립 `node apps/web/scripts/ride-verify/verify-selectors.mjs`: 종료0/19단계. `npm run build`: 종료0,기존chunk/riderRig경고 유지. `npm run lint`: 종료0,오류0/기존경고40. `git diff --check`: 종료0. Cursor도 동일명령 종료0 보고.
- 최초 수동 button측정은 display:none 조상 안의 DOM까지 센 잘못된 필터로16개를 세어 실패했다. 역할기반 접근성 셀렉터로 바로잡아 실제 노출 버튼2개를 확인했다. 실패를 제품성공으로 바꾸지 않고 측정 오류와 재검증을 구분한다.
- 기존113변경파일 해시 중 허용제품4파일·공용색인2파일·묶음README를 제외한 **106파일 모두 동일**. [보존증거](evidence/refine-preservation.json). App의 이전 위치작업 hunk 등 기존diff는 제거하지 않고 패치만 추가했다.

실기기/센서/실주행·실OAuth 미검증. 캡처는 로컬5000·PC모바일viewport이며 온라인지도 로드는 환경에 따라 다를 수 있다. 이번 변경은 지도소스·카메라·실데이터를 수정하지 않았다. fixture는 메모리 Vite virtual module로 실행 후 종료했으며 새 제품주소스위치/의존성/디버그코드 추가없음.

## Chief 확인

실행 폴더 `C:\20.HDev\boxcycle`. 기존 [로컬앱](http://127.0.0.1:5000)을 새 시크릿창으로 열어 좌상단 곡선로고·브랜드, 최초 두버튼만 표시되는지 확인. 게스트/회원 인증완료 후 위성·줌·맵 컨트롤이 나타나고 로그아웃후 숨는지 확인한다. 서버 재실행:

```powershell
Set-Location 'C:\20.HDev\boxcycle'
npm run dev -- --host 127.0.0.1 --port 5000 --strictPort
```
