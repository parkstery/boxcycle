# 감리26 — DEPLOYED / Chief 사용 확인 대기

2026-10-19 Codex. [결과26](03-result-26-release.md)의Git·로그·실제운영응답을확인했다. Chief의커밋푸시병합배포요청을완료했고,이전미배포상태를갱신한다. Chief의최종CLOSED는별도다.

- **main2 d22c0492** 원격반영,main미변경. 커밋소스분리빌드·실제배포.
- Functions12·Firestore/RTDB Rules·Hosting모두성공. 새Guest일일정리매일03:15KST활성등록확인.
- 최종web1295/서버127/독립demo32 PASS. 초기실패는결과26에구분하고교정후게이트통과. 우회없음.
- 운영bundle일치·Guest API3종204/401·모바일인트로2버튼/계정생성0확인. Google4/보호2227보존.
- 잔여: Chief실사용·실기기BLE·실제Google팝업·최종CLOSED. 운영Guest추가삭제나자동생성스모크없음.

## Chief 확인

운영 주소 **https://boxcycle-dc2df.web.app**. 강력새로고침 → 게스트로시작 → 위치선택 「내 위치 / 기본 위치」 → Ready Ride거리선택 → 사용자정보→종료 → 같은주소에서게스트로시작,기록유지확인. localhost·127.0.0.1·운영도메인은각각별도세션이므로주소를바꾸지않는다.

실행폴더 **C:\20.HDev\boxcycle**. 운영확인은로컬서버불필요:

```powershell
Set-Location C:\20.HDev\boxcycle
Start-Process 'https://boxcycle-dc2df.web.app'
```

로컬코드확인이필요하면같은폴더에서 `npm run dev:localhost` 후 http://localhost:5000 사용. 새운영함수배포완료이므로이전5000의Guest404제약해소. 운영연결이므로시험용Guest생성을반복하지말고같은브라우저/주소에서기존세션을재사용한다. demo5004는별도환경으로유지한다.
