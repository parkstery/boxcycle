# Indoor Cycle Prototype

Mapbox를 이용한 실내사이클 앱 프로토타입입니다.

## 포함 기능

- 지도 렌더링
- 출발/도착 좌표 기반 자전거 경로 생성
- 거리/예상시간 표시
- 실내 라이딩 세션 시작/일시정지/재개/종료
- 세션 결과 로컬 저장(localStorage)

## 초기 셋업 (Mapbox 토큰 설정)

이 프로젝트는 Mapbox 공개 토큰(`pk.~`)이 필요합니다.
토큰은 `config.local.js` 파일에 따로 보관하며, 이 파일은 `.gitignore`에 등록되어 깃에 커밋되지 않습니다.

1. [Mapbox Access Tokens 페이지](https://account.mapbox.com/access-tokens/) 에서 공개 토큰을 준비합니다.
   - 보안을 위해 해당 토큰의 URL 허용 목록에 `http://localhost:5500` 등 로컬 주소를 추가하세요.
2. `config.example.js` 를 같은 폴더에 `config.local.js` 라는 이름으로 복사합니다.
   - PowerShell: `Copy-Item config.example.js config.local.js`
3. `config.local.js` 를 열어 `YOUR_MAPBOX_ACCESS_TOKEN` 자리에 본인 토큰을 붙여넣습니다.

## 실행 방법

브라우저에서 파일을 직접 여는(`file://`) 방식이 아니라, 로컬 서버(`http://localhost`)로 실행해야 합니다.

1. PowerShell에서 프로젝트 폴더로 이동
   - `cd C:\Users\kdrea\Desktop\indoor-cycle-prototype`
2. 아래 중 하나로 로컬 서버 실행
   - Python 사용: `python -m http.server 5500`
   - Node 사용: `npx serve -l 5500`
3. 브라우저에서 `http://localhost:5500` 접속
4. 좌측 패널에서 출발/도착 좌표 입력 후 `자전거 경로 생성` 클릭
5. 세션 버튼으로 라이딩 기록 테스트

## 실행이 안 될 때 체크

- 개발자도구(Console)에 `CORS`, `file://`, `blocked`, `Access token` 관련 에러가 있는지 확인
- 토큰이 `pk.`로 시작하는 공개 토큰인지 확인
- Mapbox 토큰 URL 제한을 걸어둔 경우 `http://localhost:5500` 허용 필요

## 다음 확장 단계

- 고도(elevation gain) 계산 연동
- 코스 프리셋/즐겨찾기
- Firebase 동기화
