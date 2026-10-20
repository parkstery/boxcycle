# 릴리스07 — DEPLOYED / Chief 실기기 검수 대기

2026-10-21 Codex Supervisor. Chief의 커밋·푸시·배포 요청에 따라 실행했다. [결과07](03-result-07.md)·[감리07](04-review-07.md)의 구현/검증을 배포했다. 실제 Android 또는 BLE 검증을 완료했다는 뜻은 아니다.

## Git 및 배포 증거

- 코드 커밋 `ae646df9ccd1e74d8de510deb4d31a669f6aa65c` (`fix(ui): restore map-first layout and invisible edge gestures`). `fix/mobile-edge-density-20261021` → `main2` fast-forward, `git push origin main2` exit0. `git ls-remote`로 동일 SHA 확인. `main` 변경 없음.
- pre-commit PASS. pre-push 최종 PASS: 의존 방향/순환·개발 부산물 등록부·web 타입체크·동행 재생 게이트·selector19·web 단위 1,319 PASS/0 FAIL. 서버 코드/Rules 미변경으로 해당 조건부 게이트는 실행 대상 아님.
- 첫 push는 rider-gpu-skin/rider-model-profile 두 파일 실패로 차단됐다(1,319 PASS/2 FAIL). 두 파일 단독 19/19 PASS 확인 후 코드 변경·게이트 우회 없이 동일 정상 push 재실행 → 전체 1,319 PASS/0 FAIL. 최초 실패의 근본 원인은 확정하지 않았다. 최종 로그 `.out/ui-edge-20261021/push-gate-retry.log`.
- `firebase deploy --project boxcycle-dc2df --only hosting --non-interactive` exit0. 46 files, upload/finalize/release complete. 기존 Functions·Rules·운영 데이터 수정 없음.
- 주소: **https://boxcycle-dc2df.web.app**. 운영 파일 4개 HTTP200·로컬 빌드와 SHA-256 일치. HTML no-cache, 해시 자산 immutable 확인.

| 파일 | bytes | SHA-256 |
|---|---:|---|
| index.html | 632 | e33cdf8b38e9314ffe08c188ca2d0282ecd3afd5cfa3209f0b0d9967cf1dc77a |
| assets/index-Dwjm2kmZ.js | 3734005 | f86606bc81abb993766c05ed6e78cfe73c9bd727edd156d6ae959df2d188d8d0 |
| assets/jsx-runtime-1YrJdh_0.js | 8446 | 0d12fda61ef6df75717ab89d9cb62feb5711275aa1279dcfe6ce18b3bd764522 |
| assets/index-BfrqPjFi.css | 230333 | f4e2a6c6073bbe299a5042272b090709aeddef5bcfff84ebe9a95386ad663a56 |

운영 브라우저 800×360에서 Spinatlas 인트로·「게스트로 시작」 표시 및 새 JS 경로 확인. 운영에서는 버튼을 누르거나 Guest/주행 데이터를 생성하지 않았다. 첫 스모크의 「시작」 exact 셀렉터는 인트로 문구와 달라 timeout; 실제 문구 「게스트로 시작」으로 교정 후 PASS. 캡처 `.out/ui-edge-20261021/production-intro-800.png`.

## 구현 및 로컬 검증 요약

- 주소 패널 단일면, 행24px, 출발/도착 두 행은175×85px. 경유지1개마다24px씩 패널 전체가 늘어나며 최대5행157px. 내부 스크롤 없음.
- 흰색 에지 버튼/파란 막대/중복 시각 트리거 제거. 좌우20px에서 안쪽 드래그: 좌=메뉴, 우=맵뷰. 마우스/터치 지원. 헤더를 바깥쪽으로 드래그하거나 닫기 버튼으로 닫는다. 키보드 Tab/Enter 대안 유지.
- 계기판 x4/y4, 우측 컨트롤 가장자리 유지. 실제 Mapbox 버튼 클릭·지도 중앙 pan과 충돌하지 않음.
- Playwright14/14 및 최종 실지도 재실행1/1 PASS(800×360, 667×300, 844×390; 마우스·CDP 터치·멀티터치 취소·주소5행·큰수치·포커스·클릭 누수 회귀). Firebase 로컬 에뮬레이터에서만 인증/주행 쓰기 검증.
- 관련 정적시험38/38, tsc/build PASS, lint0 errors/기존37 warnings. 실제 Galaxy·OS 뒤로가기와의 충돌·BLE 체감은 미실행/Chief 확인 대기.
- 기존 dirty ops·evidence·cdbox.bat·이전 보존 stash는 임의로 포함하거나 삭제하지 않았다. 공용 ops 색인은 이번 릴리스 행만 선택 staging한다.

## 직접 확인

스마트폰: https://boxcycle-dc2df.web.app 를 새로고침하고 가로 방향으로 사용한다. 진입/위치선택 완료 후 화면 가장자리에서 약10px 안쪽을 누르고 중앙으로 드래그한다(기존 버튼/도크 영역 제외). 좌측 메뉴·우측 맵 설정이 열려야 한다. 출발/도착이 모두 보이는지, 경유지를 추가하면 창 전체 높이가 늘어나는지 확인한다. OS 뒤로가기가 먼저 실행되면 제스처 시작점을 조금 더 화면 안쪽으로 옮겨 비교한다.

PC에서는 동일한 마우스 드래그로 사용할 수 있다. 로컬 실행 폴더/명령:

```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```

http://localhost:5000 → 브라우저 800×360 → 동일 순서. 로컬 서버 실행은 운영 배포 주소 접속의 필수 조건이 아니다.
