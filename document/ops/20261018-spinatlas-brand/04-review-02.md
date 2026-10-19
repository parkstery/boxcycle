# 최종 감리02 — Spinatlas·A안 인트로

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — Supervisor 최종 감리 |
| 최초 작성 | 2026-10-18 |
| 상태 | APPROVED — 로컬 변경 범위 통과 / Chief 화면 확인 대기 |
| 독자 | chief · Developer |
| 연결 문서 | [결과01](03-result-01.md) · [결과02](03-result-02.md) · [감리01](04-review-01.md) · [묶음](README.md) |

## 판정과 역할

사용자에게 보이는 브랜드를 Spinatlas로, 인트로 제목·부제를 A안으로 변경한 범위는 합격이다. 구현은 Chief가 허용한 별도 OpenCode LongCat 세션 `ses_eb35cdc3cffeIkYv8dsSApIjuq`가 담당했다. Codex는 지시·실제 diff 검수·독립 검증·재작업 지시·결과 감리를 수행했다. 기존 네 번째 탭은 접근성 트리로 Greeting/LongCat을 확인했으나 입력 후 전송이 불가능했다. 별도 세션 실행은 Chief의 추가 승인을 따른다. 커밋·push·배포 없음. Chief 최종 화면 승인은 별도이며 CLOSED로 표시하지 않는다.

## 재작업 확인

`entry-contract.mjs`의 소개 제목 앵커를 새 문구로 변경했고 `Spinatlas는` 조사 띄어쓰기도 반영했다. 이 계약 파일의 실행 전 diff와 현재 diff를 대조하여, 기존 위치 관련 두 hunk를 보존하고 소개 제목 한 hunk만 추가한 것을 확인했다. 나머지 기존 위치 관련 소스·시험9파일의 미커밋 diff도 보존했다. 관련 e2e/spec/helper에는 이전 인트로 제목 기대가 없어 불필요한 변경은 하지 않았다.

Developer 결과01·02를 실제 파일과 대조했다. 결과01의 `RIDE THE WOILD` 언급은 보고서 오타이며 실제 삭제한 소스 문자열은 `RIDE THE WORLD`다. CSS 폭 설명은 추정값으로 보며 감리 판단은 [실측 수치](evidence/supervisor-geometry.json)를 기준으로 한다. 실패 원인이 기존 위치 변경이라는 초기 추측은 결과02에서 이번 제목 변경에 따른 계약 불일치로 정정했다.

## 독립 검증 결과

- 루트 `npm run build`: 종료0. chunk 크기·riderRig export 경고는 범위 밖으로 기록.
- 변경 제품소스 lint: 종료0, 오류0 / 기존 MapViewSheet hook 경고1. 전체 `npm run lint`는 종료1, **변경 없는 ride-result 시험4파일 오류16·경고40**로 실패. 전체 lint PASS로 보고하지 않는다.
- 재작업 후 루트 `node apps/web/scripts/ride-verify/verify-selectors.mjs`: **종료0,19단계 PASS**. `node scripts/check-document-system.mjs`와 `git diff --check`도 종료0. 상세 명령·실행근거는 감리01에 보존.
- 실제 앱 인트로 667×300,740×300,844×390,1366×768: 브랜드·제목 두 줄·부제·브라우저 title·가로 넘침 없음·CTA44px·화면 내 접근 PASS. 667×300에서 버튼 bottom241.56px로 화면 안에 위치.
- 원본 컴포넌트 fixture: 인트로 게스트/로그인 각 콜백1회, HUD idle/ready-to-start/riding/paused 브랜드·메뉴 콜백·가로 넘침 없음 PASS. 주행/일시정지 브랜드 right94.92px, 계기판 left99.64px로 겹침 없음. HUD의 기존 투명44px 히트 영역 CSS 유지.

소스 동작은 바뀌지 않은 카피·앵커 수정이므로 재작업 후 전체 빌드·화면을 중복 실행하지 않았다. 실제 OAuth·실주행·Firebase 에뮬레이터 진입 e2e·폰 실기기는 미검증. 검증 환경의 외부 지도 타일/Firestore 요청은 실패했으므로 온라인 지도 영상 품질 검증도 미완료다. 이번 변경은 해당 지도·인증·위치 로직을 수정하지 않았다. 잔여 항목을 숨기지 않고 **이번 카피·브랜드 변경의 로컬 검수 통과**로 한정한다.

## Chief 직접 확인

실행 폴더 전체 경로: `C:\20.HDev\boxcycle`. Supervisor가 포트5000에서 Vite 서버 실행을 확인했다. [로컬 앱](http://127.0.0.1:5000)을 새 시크릿 창으로 열어 인트로의 Spinatlas, 「땀으로 그리는, / 나만의 지구 지도.」, 부제를 확인한다. 가로667×300 또는740×300에서도 잘림 없이 두 버튼을 사용할 수 있는지 본다. 로그인 상태에서는 인트로가 생략될 수 있다.

서버를 다시 실행할 때:

```powershell
Set-Location 'C:\20.HDev\boxcycle'
npm run dev -- --host 127.0.0.1 --port 5000 --strictPort
```

[변경 후 모바일 화면](evidence/supervisor-after-667.png) · [PC 화면](evidence/supervisor-after-1366.png). 로컬 변경이며 운영 서비스에는 배포하지 않았다.
