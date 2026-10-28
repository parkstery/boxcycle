# 맵 뷰 메뉴 통합 — 2026-10-27

Chief 지시: 내 도로망 전체/신규 선택은 계정 내 도로망에, 3D 뷰는 카메라6 아래. 고급설정·노선 끔/도로 비교·거리 UI·맵 뷰·오른쪽 탭 제거.

범위: 프론트 메뉴와 연결만 변경. 서버·DB·Rules·정복 데이터·카메라 프리셋 의미 변경 없음. 기존 dirty 보존, 커밋·푸시·배포 없음.

금지: Chief 고정1~13·15~34의 기존 화면 유지. 고정14 오른쪽 탭만 이번 명시 지시로 제거, 왼쪽 MENU 탭 보존. 고정27 카메라 화살표·순서 보존.

구현: 계정 내 도로망 수치 아래 전체/신규 버튼(신규 geometry 없으면 비활성), 선택하면 패널 닫고 기존 지도 포커스 함수 실행. 카메라6 아래 3D 체크 항목, 작은 가로 화면 메뉴 내부 스크롤. MapViewSheet 및 navigation 상태·진입 제거. 지도 도로 비교 입력은 off 고정, 기존 확대/축소 유지.

검증·완료 결과는 후속 절에 기록한다.

## 결과 / 검증

LOCAL_VERIFIED, 미배포. 가로 800×360·667×300·699×273에서 계정 선택·닫힘·선택값 유지·신규 없음 비활성·3D 양방향 전환·카메라6 아래 배치·주행/일시정지 접근·오른쪽 진입 제거 검증. 계정 및 카메라 캡처는 이 폴더 PNG에만 기록, 기존 증거 PNG는 건드리지 않음.

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

- `npx playwright test map-menu-consolidation ui-redesign-batch4 --workers=1 --retries=0`: 최초 최종 묶음 20PASS/1FAIL. 신규 통합3개는 전부 PASS. 기존 settings 667×300 열림 애니메이션 중 경계 301.348px 측정(기대≤301px)으로 1FAIL. 기대값 유지, animation.finished 대기 후 `npx playwright test ui-redesign-batch4 --grep "패널 경계" --workers=1 --retries=0`: 9PASS/0FAIL. 고유 시나리오 최종21개 모두 통과.
- `npx playwright test ui-800x360 --grep "Chief 고정27|Chief 고정14|포커스 대안|드래그 취소·화면|주행 설정의 기본" --workers=1 --retries=0`: 5PASS/0FAIL. 삭제된 오른쪽 탭 기대만 제거, 왼쪽 계약 보존.
- `node --test scripts/conquest/recent-road-display-dom.test.mjs`: 1PASS/0FAIL. 실제 hook+계정 컴포넌트, 두 가로 폭에서 주행 종료·결과 도착·계정 전환의 신규 도로 geometry 보존.
- `npx eslint src/App.tsx src/app/useAppSheetNavigation.ts src/components/maphud/MapHud.tsx src/components/maphud/CameraViewMenu.tsx src/components/UserInfoSheet.tsx`: 오류0/기존 경고9.

실행 폴더 `C:\20.HDev\boxcycle`:

- `npm run build -w boxcycle-web`: 타입·Vite 빌드 exit0. 기존 큰 청크 경고.
- `npm run test:quick -w boxcycle-web -- map`: 156PASS/0FAIL, 하네스·에뮬레이터3파일 제외(최근 도로 DOM은 별도 실행).
- `npm run check:dep`: PASS, 방향 위반0·순환0·깨진 경로0.
- 대상 파일 `git diff --check`: 출력 없음/exit0.

중간 실패도 보존: 테스트 파일 생성 명령에서 실행폴더 중복 경로 1회 실패 후 올바른 경로로 생성. 초기 검수 상태 URL에 fixture 신호가 없어 신규 시험3FAIL→menuFixture 신호 추가. 작은 가로 메뉴가 주행 종료 버튼에 가려 1PASS/2FAIL→메뉴 최대높이에서 아래 주행 제어 여백150px 확보, 내부 스크롤 후3PASS. 루트에서 Playwright를 잘못 호출한 두 실행(신규3·패널9)은 baseURL 없는 invalid URL로 실패, apps/web에서 다시 실행하여 위 결과 확보. 이를 앱 기능 실패나 통과로 합산하지 않음.

미실행: 전체 quick(지도 관련156만 실행), 실 Firebase 인증/실지도 DEM/실센서·실제 폰 터치. 메뉴 변경 범위이므로 외부 상태 변화 없이 검수 fixture와 빌드로 확인. 배포·커밋·푸시 없음.

## Chief 확인

```powershell
cd C:\20.HDev\boxcycle
npm run dev:localhost -- --port 5031
```

`http://127.0.0.1:5031/` → 계정 → 내 도로망 전체/신규 선택 → 지도 포커스 확인. 주행 시작 또는 일시정지 → 시점 카메라 메뉴 → 아래로 스크롤 → 6번 아래 3D 뷰 켜짐/꺼짐. 오른쪽 맵 뷰 탭·고급설정·거리 조절 없음, 기존 지도 +/− 유지 확인.

서버 미리보기: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=account&menuFixture&recent`, `?state=riding&menuFixture`. 실제 계정/지도 대신 메모리 상태·검수 지도 배경임. 5031 서버는 자동 시작하지 않았음.
