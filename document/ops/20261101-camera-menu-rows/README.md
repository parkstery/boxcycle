# 카메라 메뉴 줄 맞춤·버튼 흔적

Chief 11-01: 카메라 메뉴 두 열의 가로 행 높이를 평행하게, 칸마다 버튼임을 나타내는 약간의 흔적. 아티팩트로 시안 → 「제안A 채택」.

Claude Code 직접 시안·구현. 시안 원본 `camera-menu.html`(아티팩트 「카메라 메뉴 줄 맞춤」, 현재·A·B 비교).

- 원인: 왼쪽 7칸은 27px·간격 0, 오른쪽은 27px·간격 3px + 3D 뷰 44px(구분선·5px 띄움) → 줄이 어긋남.
- 구현(`CameraViewMenu.css`): 두 목록 모두 `grid-template-rows: repeat(7, 27px); gap: 3px`, 3D 뷰 `grid-row: 6 / span 2`, 선택 안 된 칸 옅은 테두리+아래 그림자, hover·눌림. 함께 고친 기존 결함: 699×273 에서 메뉴 아래가 화면을 약 2px 넘음(HEAD 동일 확인) → 최대 높이 100dvh−74px.
- 검증: e2e 카메라 관련 15/15(compact-controls 단일 카메라 두 열 4크기·ui-800x360·toolbar), 새 계약(줄 평행·3D 두 줄·흔적) 사보타주 시 실패 확인 후 원복, eslint 0. 캡처 `evidence/cam-800.png`·`cam-699.png`.
- 미커밋·미배포.
