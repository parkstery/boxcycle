# 검수09 — 위치공유 필요 문구·클릭 안내

2026-10-17 Supervisor Codex. **APPROVED / Chief 화면 확인 대기**. OpenCode GLM-5.3 구현 [결과09](03-result-09.md), HEAD 0936cfe 위 기존 변경 보존. 세션 ses_eb6467fe4ffew3nEWko3UEpxUm. 조사 장기화 시 같은 세션에 최소 구현 재지시를 보냈다.

실제 diff 검수: 현재 위치 버튼 안 블록 span으로 정확히 `(위치공유 필요)` 둘째 줄 표시. 44px 최소 높이와 기존 작은 카드/기본 위치 버튼 유지. 클릭 시 prompt/unknown은 기존 동기 onChooseCurrent→geolocation 경로 유지, denied는 허용 방법 alert 후 callback 1회. App/hook/위치 세션 수정 없음. 네이티브 권한 차단 우회 없음.

Developer: 위치 시험22/selector19/eslint/타입 포함 build/diff 검사 PASS. Supervisor 독립 실행(폴더 `C:\20.HDev\boxcycle\apps\web`):

- `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts` → exit0, 22 PASS.
- `node scripts/ride-verify/verify-selectors.mjs` → exit0, 19단계 PASS.
- `git diff --check` → exit0.

중간 실패: PowerShell 5의 && 문법과 편집 문자열 불일치, 최초 시험의 Node alert 미지원. 명령 교정·최소 편집·alert 존재 가드/spy 시험 후 최종 PASS. 브라우저 화면/네이티브 권한창·실기기 미검증. 기존 청크/riderRig 빌드 경고 유지. 커밋·푸시·배포 없음.

직접 확인:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5014 --strictPort
```

http://localhost:5014 → 위치 차단 상태로 진입 → 현재 위치 버튼 둘째 줄 `(위치공유 필요)` → 클릭 시 허용 안내 → 브라우저 위치를 묻기로 변경하고 다시 클릭하면 네이티브 위치 요청 → 허용 후 현재 위치 이동. 이미 같은 폴더 서버가 실행 중이면 기존 주소에서 새로고침할 수 있다.
