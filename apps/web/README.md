# RTW Pro 웹 (`boxcycle-web`)

**Ride The World Pro** — Vite + TypeScript + React 본 개발 앱. npm 패키지명 `boxcycle-web` 은 엔지니어링 별칭(레거시)이다.

## 설치·실행 규칙 (혼동 방지)

- **의존성 설치:** 저장소 **루트**에서 `npm install` 한 번만 실행한다(npm **workspaces** — 루트 `package-lock.json`만 사용).
- **스크립트:** 루트에서 `npm run dev` / `npm run build` / `npm run lint` 를 쓰거나, 이 폴더에서 같은 명령을 써도 동일한 `boxcycle-web` 워크스페이스를 실행한다.
- **환경 변수:** `apps/web/.env.example` → `apps/web/.env` (Firebase 웹 SDK 값 등). 자세한 배경은 저장소 루트 [`README.md`](../../README.md) 를 본다.

**Cloud Functions**(`functions/`)는 별도 패키지이므로, Functions 쪽은 루트 README의 안내대로 `functions` 폴더에서 `npm install` 한다.
