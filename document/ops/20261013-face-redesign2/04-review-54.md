# 검수54 — 주행 Kcal 문구·체력·내용 폭

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief 첨부와 다섯 명시 요구를 반영했다. Developer Cursor Auto session `d0cd8d23-952a-43dc-b25f-866fb2321451`. 앱 face-redesign2 워크트리, 변경은 RideSettingsPanel.tsx/RideSettingsSheet.css 두 파일이다.

- 기존 칼로리 kicker를 정확히 `주행 Kcal - 체중과 체력 설정하세요. (No 센서 No 측정)`으로 변경했다. 상단 주행 설정 제목은 유지했다. CSS uppercase를 해제해 요청 대소문자를 보존했다.
- 버튼 앞 체력 라벨과 그룹 접근성 이름을 추가했다. 세 버튼 표시·title은 약함/보통/강함이다. underlying light/moderate/기존 강함 id 및 계산 옵션은 그대로며 공용 옵션 상수는 수정하지 않았다.
- 페달이 도는 시간으로 시작하는 설명 문단을 삭제했다.
- 패널 width:max-content로 내용 폭에 맞추고 viewport 상한을 유지했다. 체중 입력·강도 버튼 높이22px, 폰트/체크박스·기존 기능은 유지했다. 다음 주행 카드/센서·펄스·다른 설정은 변경하지 않았다.

## 검증

코드 커밋 `93d9284`.

- `node document/ops/20261013-face-redesign2/settings-54-qa.cjs`: exit0, 실제 RideSettingsSheet/Panel·기존5013·headless browser1/page1. 다섯 viewport×rich/simple/BGM미설정/고도로딩=20상태. 정확 문구·체력·약함/보통/강함·설명 없음·22px·폰트·공유 CSS 모의사용처 불변·화면내표시·가로/세로 스크롤0 PASS. pageerror0. [JSON](settings-54-results.json)·[1020 캡처](settings-54-1020.png).
- 새 문구가 적용된 동일 DOM의 CSS 전후 폭: 폰351→266.67px, PC416→316.92px(약24% 축소). 직전52 실제 기본 상태351×135.72px 대비 최종266.67×108.92px로 폭·높이 모두 감소했다. CSS 전후 비교는 텍스트 변경 전후 비교가 아님을 구분한다.
- 체중75 입력·약함선택(light)·코칭/TTS/BGM/페이서·Escape/배경닫기 콜백 PASS. 나머지 옵션은 기존 opt.id 전달 코드와 실제3개 표시를 대조했다.
- apps/web `npx tsc -b --pretty false`, `npx eslint src/components/ride/RideSettingsPanel.tsx`, `git diff --check`: 모두exit0. 정상pre-commit 적용.
- 첫 fixture는 baseline CSS의 uppercase와 의도한 대소문자 차이를 문구 차이로 판단해 실패했다. CSS 비교만 소문자 정규화하고 최종 실제 문구는 정확 문자열로 별도 확인해 최종PASS했다. 앱 수정은 없었다.

실기기·키보드·실주행 전체e2e는 미검증이다. 5013에서 주행 설정 확인. push/merge/deploy 없음.
