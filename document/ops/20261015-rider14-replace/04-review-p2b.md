# 감리 P2b — 팔레트 컬러 키트

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-15 · Supervisor (Claude) |
| 대상 | [03-result-p2b.md](03-result-p2b.md) |
| 판정 | **APPROVED — 해제 순서 결함 1건은 P3 §0 에서 보정** |

## 독립 확인

- Muse 세션은 결과 파일 작성(22:29) 후 시스템 메모리 부족으로 강제 종료됨. 작업은 완료 상태.
- 코드 검토: `RiderPaletteKit` — self 는 원본 map, peer/pacer 는 최초 1회 `DataTexture`(sRGB·NEAREST·밉맵 없음·flipY false·wrap 복사), 이후 참조 교체만. 키트 색 상수 불변, 칸 좌표는 `userData.palette.colorSlots` 에서 읽음. 셰이더 무수정.
- P2a 보정 4건 확인: 확장자 import 제거, `import.meta.env.DEV`, 벤치 패널 표시(`rider14 · 20261015-212136-df8de090`), `npm run test:rider-preserve`.
- Supervisor 재실행(PowerShell): `test:rider-preserve` 19/19 + 계약 5/5, `tsc` 0. (Git Bash 에서는 npm 스크립트 셸 차이로 경로 오류 — 시험 문제 아님)
- 캡처 `p2b/rider14-z22.png`: 주황(self)·청록(peer)·슬레이트(pacer) 구분, P0 s5 화면과 배색 동일. 같은 좌표 픽셀 차 ±3 이내(보고 수치).

## 결함 (P3 §0 에서 보정)

`PreservedRiderRig.dispose()` 가 `visualKit.dispose()` 를 **먼저** 부른다. 마지막 `apply` 가 peer/pacer 였다면 그 시점 `material.map` 은 키트 텍스처이므로, 이어지는 머티리얼 텍스처 sweep 이 **원본 팔레트 map 을 찾지 못해 해제하지 않는다**(GPU 텍스처 1장 누수, 레이어 재생성마다 누적). 레이어는 프레임마다 self→peer→pacer 순으로 그리므로 실제로 마지막 상태는 pacer 인 경우가 흔하다.

보정: `RiderPaletteKit.dispose()` 가 먼저 `material.map = originalMap` 으로 되돌린 뒤 키트 텍스처를 해제한다. 시험: peer 적용 상태에서 rig `dispose` → 원본 map 과 키트 텍스처 모두 `dispose` 이벤트 1회씩.
