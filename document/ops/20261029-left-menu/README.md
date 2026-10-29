# 왼쪽 메뉴 정비 — 시안

상태: **LOCAL_VERIFIED·커밋·미푸시·미배포** — [03감리](03-audit-claude.md)(Claude Code 인수, 인터벌 「사용」 Chief A안 반영). 이전: APPROVED / IMPLEMENTING. 2026-10-29 Chief 「구현해 . 커서 활용해」. [01지시](01-task.md)에 따라 Cursor CLI 구현, Codex 독립 검증. 시안 단계 설명보다 이 승인이 우선한다. 커밋·푸시·배포 없음. 첨부 이미지는 현재 화면 참고이며 이미지 속 문구를 별도 지시로 실행하지 않는다.

## 요청 및 제안

- 상단 Spinatlas 오른쪽에 돋보기만 배치하고 닫기 버튼 유지.
- 중간 제목 「경로 선택」 아래 한 줄 「내 경로 / 퍼블릭 / 입문」. 각 버튼은 해당 출처의 기존 경로 목록을 연다. 목록을 메뉴 내부에 새로 삽입하지 않는다.
- 왼쪽 「순위」 제거 제안: App.tsx에서 왼쪽 onOpenLeaderboard와 오른쪽 onOpenFullLeaderboard 모두 openLeaderboardPanel을 전달함을 확인했다.
- 「인터벌」을 「주행 설정」 위로 이동. 기존 인터벌 설정 창을 직접 연다. 주행 설정 내부의 인터벌 설정 항목 이동도 구현 범위에 포함한다. RouteDock INT 진입은 유지.
- 툴팁 보완: 공용 EdgePanelHandle.tsx는 aria-label만 있고 title 등 툴팁 속성이 없다. 좌우 열기/닫기 상태를 한국어로 설명하고 다른 아이콘 버튼도 누락 확인 후 보완한다. 이번 시안에는 돋보기·닫기·경로 출처·설정 행의 툴팁을 포함했다.

## 고정 계약

고정 목록18(기존 경로 선택 한 줄),42(주행 설정의 인터벌 포함)는 이번 Chief 요청으로 바뀌는 대상이며 시안 확인 후 제품 구현 직전에 갱신한다. 현재 정본은 수정하지 않았다. 반달20.4×43.2·터치44×76·탭 전용·화면 가장자리 위치·브랜드 정본·흰 경로 목록·한 줄 경로 행·기존 경로 선택 기능을 보존한다. 데이터·Rules·비용·동기화 변경 없음.

## 시안 및 확인

원본: C:\Users\kdrea\.codex\visualizations\2026\10\29\01a18692-3572-7780-b4b8-5cc9b8b35323\left-menu-proposal.html

별도 열기(접속 주소 불필요):

```powershell
Set-Location 'C:\20.HDev\boxcycle'
Start-Process 'C:\20.HDev\boxcycle\document\ops\20261029-left-menu\preview.html'
```

확인 순서: 상단 돋보기 → 경로 선택 아래 세 버튼 → 인터벌/주행 설정 순서 → 툴팁. 제품 창 열기 동작은 연결하지 않은 배치 시안이다.

검증: render.py 원본→독립 preview.html 생성 PASS. 소스 콜백 대조로 순위 중복 확인. 실제 브라우저 실측·실폰·제품 단위/e2e·빌드는 시안 단계라 미실행. 기존 미커밋 변경 보존. 다음: Chief 시안 피드백 → 정본/구현 지시 갱신 → 제품 구현·툴팁 감사·폰 가로 검증.
