# 감리08 — Mapbox 상시 툴 제거 / DEPLOYED

2026-10-21 Supervisor Codex. 지시08 실제 diff 확인 및 독립 시험으로 **LOCAL_VERIFIED**. 지구본·나침반 컨트롤은 생성/등록하지 않고, 하단 지표·저작권·로고는 보존한다. [결과08](03-result-08.md)의 명령/미실행 범위를 따른다. 기존 미관련 dirty는 제외한다.

확인: Node2/2·타입포함 build·변경TS lint 오류0·실 Mapbox DOM3크기·diff PASS. 실기기/주행 e2e 미실행. 이 파일은 배포 완료 증거로 갈음하지 않으며, 정상 push/Hosting 후 결과를 추가한다.

직접 확인:

```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```

http://localhost:5000 → 800×360 → 지도 오른쪽의 지구본·나침반이 없고 맵 설정/확대축소·하단 축척/고도가 유지되는지 확인.

## 릴리스 증거

코드 `4aae5ed950bc6025cbf260a163ccb3bb0270c2b9`를 기능브랜치→main2 fast-forward·push 완료(exit0). 정상 pre-push: 단위1,321 PASS/0FAIL, selector19·의존방향·dev-tools·tsc·동행재생 PASS. 로그 `.out/ui-edge-20261021/push-controls08.log`. main 미변경, 미관련 dirty 제외.

`firebase deploy --project boxcycle-dc2df --only hosting --non-interactive` exit0(46 files, upload/finalize/release complete). https://boxcycle-dc2df.web.app 에서 HTML/JS/CSS 4파일 HTTP200·로컬과 SHA-256 동일:

- index.html(632B): `23394d0300acfb34649cc689094ff9cb0dce1e8c41e60bd3a12a8de5f111bc22`
- assets/index-Cc7mOZA-.js(3733077B): `982d1491b80c5375f33c6400b1265424c84f0b46b782a3dba4e2c12efa430697`
- assets/jsx-runtime-1YrJdh_0.js(8446B): `0d12fda61ef6df75717ab89d9cb62feb5711275aa1279dcfe6ce18b3bd764522`
- assets/index-C7Y41S1a.css(229573B): `d8e39615ac3b4608dabfb2a996691aa0161e0d0961fed67a137c1a0350e44d09`

운영 Playwright 800×360: map=true, globe/compass/top-right button=0, logo/attribution/scale/altitude 각각1. 새 JS 경로 확인. Guest 버튼을 누르지 않았으며 운영 인증·주행 쓰기 없음. 실제 Galaxy 검수는 Chief 대기. 로컬 검사 서버5022/커서 세션은 중단했다.
