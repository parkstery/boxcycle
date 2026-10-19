# 결과02 — Codex 마감·실제 지도 검증

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 구현 마감·검증 결과 |
| 최초 작성 | 2026-10-18 |
| 상태 | 완료 / Chief 화면 확인 대기 |
| 독자 | chief · AI |
| 연결 문서 | [초안기록](03-result-01.md) · [최종감리](04-review-02.md) · [재지시02](02-task-02.md) |

담당: Codex. cwd `C:\20.HDev\boxcycle`, main2 / HEAD `0936cfe910c4a826c9b829a529478a2f9950d5f2`. LongCat 원래 세션을 실제 interrupt한 뒤 쓰기 담당을 넘겨받았다. 수정 제품파일은 **AppIntroScreen.tsx/.css 두 개만**이다.

마감: 폰 제목24px·브랜드22px·마크28px·eyebrow10px로 명시, 부제를 기존 문장 그대로 두 block 구절로 균형 정렬, PC하단3단계 grid3열, CTA배경만 짙은 코랄#d9362b(흰글자4.65:1)·hover더어둡게. Mapbox logo/출처 컨트롤은 z-index41로 인트로40 위에 두고 로고를22px 올려 저작권과 겹치지 않게 했다. 지도조작 차단은 유지한다. 기존 제목 literal/props/인증콜백/접근성 이름/세로 회전 정책 유지. 새 지도·타이머·의존성·전역테마·가짜 상태·외부이미지 추가 없음.

실제 앱6크기·실지도, 원본 컴포넌트3크기 키보드/콜백/reduced-motion, selector19, lint오류0/기존경고40, 최종build, 문서·공백검사 통과. 상세 수치·명령·한계는 최종감리 한 곳에 기록한다. 폰 실기기·실제 OAuth·센서·실주행은 이번 디자인 변경 검증에 포함하지 않았다. 커밋·push·배포 없음.

재현 폴더 `C:\20.HDev\boxcycle`. 기존 Vite5000 재사용, 새 시크릿창 [로컬앱](http://127.0.0.1:5000)에서 인트로를 확인한다. 서버가 없을 때:

```powershell
Set-Location 'C:\20.HDev\boxcycle'
npm run dev -- --host 127.0.0.1 --port 5000 --strictPort
```
