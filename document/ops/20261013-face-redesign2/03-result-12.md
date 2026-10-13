# 결과12 — 프로필 컨트롤 22px (Chief 22px 지정 우선)

- 수정 파일: `apps/web/src/components/ProfileEditSheet.css`, `apps/web/src/components/ProfileEditSheet.tsx` 2개만. `commonRideSettingsSheet.css` 미수정.
- TSX: 첫 닉네임 group에 `profile-edit-sheet__nickname` 전용 class 부여, `칼로리 계산` kicker span 제거. 그 외 markup·문구·기능(Guest 안내/잠금/에러/저장중/폼) 보존.
- CSS: 닉네임 input·체중 input·강도 칩·취소/저장 버튼에 `height: 22px; min-height: 22px; box-sizing: border-box; padding-block 0` 계열로 computed 22px 보장, 글씨 잘림 방지용 line-height만 조정. 폭(체중 3.9rem·닉네임 100%)·폰트 크기 보존. 첫 group은 `grid auto minmax(0,1fr)`로 라벨·입력 같은 행, help는 `grid-column: 1/-1` 전체 행. pseudo 44영역 추가 없음.
- 검증: `git diff --check` 통과(출력 없음). tsc/browser는 Supervisor 담당 per 지시.
