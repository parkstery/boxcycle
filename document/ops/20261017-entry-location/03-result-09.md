# 결과09 — 현재 위치 버튼 보조문구와 클릭 안내

2026-10-17. OpenCode GLM-5.3 (`opencode/glm-5.3-flash-free`). 시작 HEAD 0936cfe, 기존 dirty(ops 문서·지시07/08 파일) 보존.

## 변경
- `src/components/auth/EntryLocationDialog.tsx` — 현재 위치 버튼 둘째 줄 블록 span `(위치공유 필요)`(지시09), `aria-label={CURRENT_LABEL}` 고정, denied 클릭 시 `globalThis.alert(DENIED_GUIDANCE)`(런타임에 alert 없으면 생략) 후 기존 `onChooseCurrent()` 1회.
- `src/components/auth/EntryLocationDialog.css` — `.entry-location__button-hint` `display: block` 소폭 규칙 추가.
- `scripts/identity/entry-location.test.ts` — 버튼 탐색은 access 이름(`aria-label`)으로, 보조문구 span·CSS block 검증, denied/prompt 클릭 alert spy 시험 1건 추가(spy finally 복원). pass 22/22.
- `scripts/ride-verify/entry-contract.mjs` — 내 위치 클릭 앵커를 alert 뒤 재시도 구조로 갱신, 접근성 고정·보조문구 앵커 소폭 추가. verify-selectors 19단계 전부 유효.

App·hook·geo 세션 API 변경 없음. 실행: verify-selectors exit 0, 테스트 pass 22·fail 0, eslint 0 문제, `npm.cmd run build` 성공(기존 riderRig chunk 경고 선재), `git diff --check` exit 0.

한계: 브라우저 네이티브 권한창·실기기(폰 가로) 미검증. Chief 직접 확인: `Set-Location C:\20.HDev\boxcycle\apps\web; npm.cmd run dev -- --host 127.0.0.1 --port 5014 --strictPort` → http://localhost:5014 위치 차단 카드 두줄·클릭 alert 안내 → 사이트 설정 허용 후 같은 버튼 재시도.
