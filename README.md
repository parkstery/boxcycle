# BOXCYCLE

문서 작성은 `document/260509-BOXCYCLE-문서-생성-및-수정-지침.md`를 따른다.

**현재 단계·범위·스택·1차 마일스톤(멀티 유저 검증)** 의 단일 진실은 [`document/260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md`](document/260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md)를 본다.

**서비스 비전·UGC 정책·저장 전략(장기)** 의 단일 진실은 [`document/260511-RTW-마스터-비전-및-종합계획.md`](document/260511-RTW-마스터-비전-및-종합계획.md)를 본다.

Mapbox 기반 **실내 사이클** 서비스입니다. Mapbox 시뮬 검증은 완료되었으며, 본 개발 앱은 **`apps/web`** (Vite + TypeScript + React + Firebase Auth) 에서 진행한다.

## 본 개발 웹 앱 (`apps/web`)

저장소 루트에도 `index.html`(Mapbox 레거시 POC)이 있으므로, **어떤 폴더에서 `vite`를 실행했는지**에 따라 같은 `localhost:5173` 이라도 다른 화면이 뜰 수 있다.

| 화면 특징 | 무엇이 떠 있는지 | 인증 |
|-----------|------------------|------|
| 좌측 긴 패널(지명 검색·경로·라이딩 세션)·지도가 전체 | 루트 **레거시** `index.html` + `app.js` | 없음 |
| 상단 인증 영역 + 하단 **큰 지도**(위성·내비·축척) | **`apps/web`** React 앱(`#root`만 존재) | Firebase(동기화). 지도는 **Mapbox 토큰**만 있으면 로그인 없이도 타일 표시 |

**빠르게 확인:** 페이지에서 **마우스 우클릭 → “페이지 소스 보기”** — 본문에 `<div id="app"` 이 있으면 레거시, `<div id="root"` 만 있으면 `apps/web`.

1. [Node.js LTS](https://nodejs.org/) 설치
2. PowerShell:

```powershell
cd C:\20.HDev\boxcycle\apps\web
npm install
Copy-Item .env.example .env
# .env 에 Firebase 웹 앱 설정값 + VITE_MAPBOX_ACCESS_TOKEN(pk.) 입력 후 저장
npm run dev
```

또는 저장소 루트에서: `npm install` 은 위와 같이 **`apps/web`** 에서 한 번 실행한 뒤, 루트에서 **`npm run dev`** (스크립트가 `apps/web` 개발 서버를 띄움).

**Firebase CLI:** 프로젝트 연결은 저장소 **루트**의 `.firebaserc`(기본 프로젝트 ID)와 `firebase.json`을 쓴다. 명령은 루트에서 실행한다.

**Firestore(프로필/로비/라이드/코스 동기화):** Firebase Console에서 **Firestore Database** 를 생성한다. 로그인 시 `users/{uid}` 문서에 표시 이름·이메일 등을 **merge** 저장한다. 로비는 `rooms/{roomId}/members/{uid}`, 주행 요약은 `rides`, 큐레이션·입문 코스는 `courses`(시드·조회), 입문 허브 동행 위치는 `coursePresence/{courseId}/members/{uid}` 를 사용한다. 저장소 루트의 `firestore.rules`, `firestore.indexes.json`을 기준으로 적용한다.

**Hosting:** `firebase.json` 이 `apps/web/dist` 를 SPA(`rewrites` → `index.html`)로 배포하도록 설정되어 있다. 배포 전에 웹 앱을 빌드해야 한다.

```powershell
cd C:\20.HDev\boxcycle
# Firestore 규칙·인덱스만
firebase deploy --only firestore
# 웹 빌드 + Hosting (또는 npm run deploy:hosting)
npm run build
firebase deploy --only hosting
```

개발용 규칙 예시는 아래와 같다(운영 전 반드시 재검토).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false;
    }
    match /rooms/{roomId}/members/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. 브라우저에서 터미널에 표시된 주소로 접속한다.
   - **이 PC만:** `http://localhost:5173` (또는 `http://127.0.0.1:5173`)
   - **같은 Wi-Fi의 다른 기기:** 터미널에 출력되는 **`Network` — `http://192.168.x.x:5173`** 형태의 주소를 사용한다. (`apps/web` 의 Vite 설정이 **LAN 바인딩**을 켜 두었다.)

**LAN 접속이 안 될 때:** Windows **방화벽**에서 Node.js(또는 포트 5173) 허용 여부를 확인한다. 이 PC의 IP는 PowerShell에서 `ipconfig` → **무선 LAN 어댑터 Wi-Fi** 의 **IPv4 주소**를 본다.

**Firebase Google 로그인을 폰에서도 쓸 때:** Firebase Console → Authentication → 설정 → **승인된 도메인**에 `192.168.x.x` 같은 **호스트만** 추가할 수 없고, **정확한 호스트 문자열**이 필요하다. IP가 바뀔 때마다 추가하거나, **ngrok·Cloudflare Tunnel** 등으로 고정 HTTPS 도메인을 쓰는 편이 낫다. (지도·로비만 테스트하고 로그인은 PC만 할 경우는 생략 가능.)

**Mapbox 토큰 URL 제한**을 쓰는 경우: `http://192.168.x.x:5173/*` 를 허용 목록에 넣는다.

**LAN에 열지 않고 이 PC만:** `cd apps/web` 후 `npm run dev:localhost`

**실시간 로비 방:** 기본은 `default` 이다. 다른 방은 **`http://<호스트>:5173/?room=my-ride`** 처럼 쿼리로 지정하거나, 화면의 **방 ID + 입장** 으로 전환한다. Firestore 경로는 `rooms/{roomId}/members/{uid}` 이다.

**Google 로그인 테스트**는 Cursor **간이 브라우저(리디렉션 탭)** 대신 **Chrome / Edge 같은 일반 브라우저**를 권장한다. 임베디드 탭에서 `firebaseapp.com/__/auth/handler` 가 흰 화면으로 멈추는 경우가 있다(팝업·쿠키·리디렉션 제한).

Firebase Console에서 **Authentication → Google** 사용 설정 및 **Authentication → 설정 → 승인된 도메인**을 확인한다.

- **`localhost`와 `127.0.0.1`은 서로 다른 출처입니다.** 브라우저에서 `http://127.0.0.1:5173` 으로 열면 콘솔에 **`App domain is unauthorized`** 가 날 수 있다. 해결은 둘 중 하나다.  
  1. 승인된 도메인에 **`127.0.0.1`** 을 추가하거나  
  2. 항상 **`http://localhost:5173`** 으로만 접속한다.  
- **`.env`를 저장한 직후**에는 개발 서버를 한 번 재시작해야 Vite가 환경 변수를 반영한다.

빌드 확인: `npm run build` → 산출물은 `apps/web/dist/` .

## 레거시 POC(검증 완료) 포함 기능

정적 `index.html` / `app.js` 기준 구현이다.

- 지도 렌더링
- 출발/도착 좌표 기반 자전거·자동차·보행 경로 생성
- 거리·예상 시간 표시
- 실내 라이딩 세션 시작/일시정지/재개/종료
- 고도 프로필(Open-Meteo)·My routes 등 ([`document/260508-개발중간보고-HTML과-JS-프로토타입.md`](document/260508-개발중간보고-HTML과-JS-프로토타입.md) 참고)
- 세션·즐겨찾기: 브라우저 `localStorage`

## 초기 셋업 (Mapbox 토큰 설정)

이 프로젝트는 Mapbox 공개 토큰(`pk.~`)이 필요합니다.
토큰은 `config.local.js` 파일에 따로 보관하며, 이 파일은 `.gitignore`에 등록되어 깃에 커밋되지 않습니다.

1. [Mapbox Access Tokens 페이지](https://account.mapbox.com/access-tokens/) 에서 공개 토큰을 준비합니다.
   - 보안을 위해 해당 토큰의 URL 허용 목록에 `http://localhost:5500` 등 로컬 주소를 추가하세요.
2. `config.example.js` 를 같은 폴더에 `config.local.js` 라는 이름으로 복사합니다.
   - PowerShell: `Copy-Item config.example.js config.local.js`
3. `config.local.js` 를 열어 `YOUR_MAPBOX_ACCESS_TOKEN` 자리에 본인 토큰을 붙여넣습니다.

## 레거시 POC 실행 방법

레거시 정적 파일(`루트 index.html` · `app.js`)만 실행할 때 사용한다. 브라우저에서 `file://` 로 연하지 말고 로컬 HTTP 서버로 연다.

1. PowerShell에서 저장소 루트로 이동 (예: `cd C:\20.HDev\boxcycle`)
2. 아래 중 하나로 로컬 서버 실행
   - Python: `python -m http.server 5500`
   - Node: `npx serve -l 5500`
3. 브라우저에서 `http://localhost:5500` 접속
4. 좌측 패널에서 출발/도착 좌표 입력 후 `자전거 경로 생성` 클릭
5. 세션 버튼으로 라이딩 기록 테스트

## 실행이 안 될 때 체크

- 개발자도구(Console)에 `CORS`, `file://`, `blocked`, `Access token` 관련 에러가 있는지 확인
- 토큰이 `pk.`로 시작하는 공개 토큰인지 확인
- Mapbox 토큰 URL 제한을 걸어둔 경우 `http://localhost:5500` 허용 필요

## 본 개발 방향 (요약)

- 클라이언트: **Vite + TypeScript + React** → 최종 안드로이드는 **웹 래핑(Capacitor 등)** 우선  
- 초기 데이터·백엔드: **Firebase** 로 서비스 동작·멀티 유저 검증 후 분리  
- 인증(1차): **Google(Gmail)** 로 빠른 검증  

상세는 위 **현재 단계** 문서 링크를 본다.
