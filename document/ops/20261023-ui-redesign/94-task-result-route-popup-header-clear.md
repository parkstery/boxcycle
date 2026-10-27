# 지시·결과 94 — 경로 생성 창: 큰 제목·탭 옆 경로 삭제·녹색 원 주행

2026-10-26 · Chief 직접 지시(시안 이미지) · Supervisor Claude Code(Opus 5.5) 직접 구현·검증 (디자인 맞춤은 Supervisor 직접 — Cursor CLI 는 자동 권한 검사 거부 상태)

## 지시

1. 「경로 생성」 제목답게 글자를 크게.
2. 「Start·End」·「거리·방향」 탭 가로 길이를 줄이고, 줄어든 오른쪽에 「경로 삭제」(빨간 테두리).
3. 맨 아래 줄 「경로 삭제」가 빠진 자리로 「주행」을 오른쪽 끝에. 둥근 사각(알약) 테두리를 없애고 버튼만.
4. 두 탭(Start·End, 거리·방향) 모두.

## 구현

- `mapPopupElements.ts`: 새 `tabsRow`(= 탭 + 「경로 삭제」) — 머리는 `[제목] / [탭 · 경로 삭제]` 두 줄. 맨 아래 줄은 `[자동차][자전거][도보] … [▶]`. 주행 버튼은 「주행」 글자를 빼고 녹색 원 아이콘만(화면 읽기 이름 「주행 시작」 유지). 끌어 옮기기 예외(pointerdown 차단)는 탭 줄 전체로.
- `RoutePickPopup.css`: 제목 17px(설정 창 제목과 같음, 잔여 토큰 문구로 바뀐 때는 13px). 탭은 남는 폭, 「경로 삭제」 30px·빨간 1.5px 테두리(`#dc2626`)·검은 글자. 주행 버튼 32px 녹색 원, 테두리·배경 없음, 줄 오른쪽 끝.
- 두 버튼의 동작(지시93 주행 중 삭제 확인 창, 지시90·91 5회 펄스)은 그대로.
- 시험 교정: 옛 배치를 고정하던 `distance-direction-attention`·`distance-route-result-layout`·`route-media-controls`·`route-ride-controls`·`ui-redesign-batch5`·`distance-auto-route-contract` 를 새 배치로. `route-ride-controls` 우측 하단 버튼 44px 측정은 지시91 이후 미리보기 펄스(1.1배) 중에 재어 48px 로 실패하던 것을 변형 전 크기로 재게 고침(지시91 누락).
- 지시93 누락 보완: 새 파일 `lib/route/routeClearGuard.ts` 를 `apps/web/dep-layers.json` route 도메인에 등록(의존 방향 검사기 M0 실패 원인).

## 검증

| 항목 | 결과 |
|---|---|
| 타입 | `npx tsc -b --noEmit` exit 0 |
| lint(변경 파일) | 오류 0 |
| 화면 e2e(경로 창 9개 스펙) | 55 PASS · 2 SKIP(기존 조건) · 0 FAIL (교정 뒤 재실행 포함) |
| `test:quick` | 1381 PASS / 0 FAIL |
| 셀렉터·구조 | verify-selectors 19/19, code-tidy 기준선 이내, dep-direction 통과(routeClearGuard 등록 후), 문서 검사 newErrors 0 |
| 캡처 | 800×360 Start·End·거리·방향 두 탭(임시 폴더) — 시안과 같은 배치 |
| 미실행 | 실앱(에뮬레이터) 확인은 이번엔 안 함 — 팝업 DOM 은 하네스와 실앱이 같은 `buildPickPopup` |

## 상태

LOCAL_VERIFIED / 미커밋·미푸시·미배포.
