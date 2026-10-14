# 최종감리33 — 모드별 접기와 펼침 접근 승인

2026-10-14 Supervisor Codex, 구현 Developer OpenCode Muse Spark1.3. **APPROVED / AWAITING_CHIEF**. Chief 요청 범위30과 터치31·재배치32·내용높이33 보정을 합쳐 검수. commit/push/merge/deploy 없음, face-redesign2 관찰 서버 http://127.0.0.1:5013/ 유지.

## 최종 동작

- 위치 모드: 위치 버튼 펼침/거리 입력 접힘. 거리 모드·재개: 거리 입력 펼침/위치 버튼 접힘. 공통 이동수단·경로 삭제 유지.
- 한 행의 위치 선택/거리 선택 버튼으로 각 영역을 펼치고 접으며, 양쪽을 함께 펼칠 수 있다. 펼침 자체는 입력이나 탐색 콜백을 바꾸지 않는다. 거리 checkbox 켬/끔은 모드에 맞춰 패널을 상호 접는다.
- 거리 모드에서 위치 영역의 Start/WP/End를 누르면 방향 선택 대기·원 정리 후 위치 지정으로 돌아간다. 기존 핀/목표거리/수단을 펼침만으로 초기화하지 않는다. 오류/검색/발견 안내는 접힌 컨트롤 밖에 표시.
- 새 토글44px, aria-expanded/controls와 키보드·포커스 지원. dock 크기 변화에 기존 위치 계산을 다시 적용하여 화면 안에 유지. 내부 높이는 실제 사용 가능 viewport까지 허용, 긴 내용은 기존 스크롤로 접근.

## 독립 검증과 증거

| 실행 | 결과 | 증거·범위 |
|---|---|---|
| `node document/ops/20261013-face-redesign2/pick-31-qa.cjs` | exit0 PASS | [20상태 결과](pick-31-shots/results.json), 667/740/844/1366, 초기·재개·오류·토큰·양쪽 펼침·목표거리 보존·모드 전환·키보드·토글44px/동일행/가로overflow0 |
| `node document/ops/20261013-face-redesign2/pick-33-live.cjs` | exit0 PASS | [최종 실제 앱 결과](pick-33-live/results.json), 실제 Guest, 667×300/740×300/844×390, 18상태 경계·위치/거리/양쪽·전환·drag·drag후펼침·close/reopen |
| `npx tsc -b --pretty false` (작업 web) | exit0 PASS | 최종 TS 변경 포함 |
| `npx eslint src/components/map/MapView.tsx src/components/map/mapPopupElements.ts` | exit0, 오류0/경고8 | 기존 hook cleanup/dependency 위치에 경고. diff의 변경 영역은 dock observer뿐, 경고를 숨기거나 전체 lint 무경고로 보고하지 않음 |
| `node scripts/ride-verify/verify-selectors.mjs` (작업 web) | exit0 PASS | 15단계 앵커 유효, 앵커 변경 없음 |
| `git diff --check` (작업 worktree) | exit0 PASS | whitespace 오류 없음 |

740×300 실제 dock 높이: 위치161.05px / 거리222.27px / 양쪽243.63px. 최종3viewport18상태 전부 viewport 안, pick.scrollHeight-clientHeight=0. [740 거리 캡처](pick-33-live/740-distance.png)로 프리셋·ETA·방향 안내 전체 표시 확인. 주소/버튼/글자 크기 보존. 위치 모드는 직전29 전체표시보다 낮아졌지만 거리모드는44px 공통토글/안내를 포함하여 더 높음; 양쪽 컨트롤의 상시 혼합은 해소됨.

## 실제 diff 범위와 한계

앱 변경은 mapPopupElements.ts(모드 패널/전환), MapView.css(pick scoped/높이), MapView.tsx(dock resize lifecycle) 세 파일. 이전29 CSS 및 다른 메뉴/계정/목록 dirty 보존. 공식 지시·결과·감리는30~33 각각 별도 파일.

실제 앱 검증은 PC의 모바일 viewport 에뮬레이션이며 실기기 터치/Bluetooth/실제 주행은 미검증. 방향 클릭 후 원격 도로 탐색 성공·경로 저장·Route Token 차감은 이번 브라우저 검증에서 수행하지 않음(해당 정책/알고리즘 변경 없음). 최종 Chief 사용확인·채택은 대기, 배포 완료 아님.
