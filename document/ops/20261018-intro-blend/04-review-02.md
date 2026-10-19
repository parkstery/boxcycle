# 최종 감리02 — 두 레퍼런스 결합 인트로

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 실제 화면·동작·변경보존 검수 |
| 최초 작성 | 2026-10-18 |
| 상태 | APPROVED — 로컬 검증 완료 / Chief 디자인 확인 대기 |
| 독자 | chief · AI |
| 연결 문서 | [초안기록](03-result-01.md) · [마감결과](03-result-02.md) · [초기감리](04-review-01.md) |

## 결과

업그레이드안의 실제 콜로세움 위성지도·명확한 브랜드/제목과 콘셉트안의 남색·따뜻한 흰색·코랄 강조를 결합했다. PC는56px 두줄 제목·하단3열, 폰은24px 제목·22px 워드마크·균형잡힌 부제2줄·44px CTA에 집중한다. [PC 화면](evidence/final-1366x768.png) · [폰275 화면](evidence/final-667x275.png). 실제 지도 영상이며 레퍼런스 스크린샷을 앱 배경으로 사용하지 않았다.

LongCat 초안을 Codex가 독립 검수했고, 지연된 재작업은 해당 모델 세션을 실제 중단한 뒤 Codex가 직접 마감했다. 따라서 최종 마감에 대한 별도 독립 작성자 검수를 가장하지 않는다. 실제 diff와 자동 측정/키보드/브라우저 실행을 근거로 승인한다. Chief 최종 디자인 확인은 별도이며 CLOSED 아님.

## 실행 증거

| 항목 | 결과 |
|---|---|
| `node apps/web/scripts/ride-verify/verify-selectors.mjs` | 종료0,19단계 PASS. 카피·region·콜백·버튼이름 계약 유지 |
| `npm run lint`(루트) | 종료0, 오류0/기존경고40 |
| `npm run build`(루트) | 최종 출처간격 수정 후 종료0. 기존 chunk크기·riderRig export 경고 유지 |
| `node scripts/check-document-system.mjs` | 종료0,깨진링크/구조오류0 |
| `git diff --check` | 종료0 |
| 실제 앱6크기 | 667×275,667×300,740×300,844×390,1366×768,1440×900 PASS. 초기 최종 실지도응답109/109 성공, 출처간격 재검증112/112 성공 |
| 제목·부제·CTA | 각제목span1행씩 총2행, 부제각구절1행씩 총2행, 정확한부제 textContent, 가로overflow0·좌측scrolloverflow0·두 CTA44px·화면 내 표시 |
| 지도 출처 | 6크기에서 Mapbox로고 중심 hit-test 링크 도달, 저작권bar와 rect겹침0. 지도 일반영역 hit-test는 여전히 인트로가 받아 기존 조작 차단 유지 |
| 원본 컴포넌트 fixture | 667×275,740×300,1366×768에서 Tab→게스트 Enter/Tab→로그인 Space 각 콜백1회, accessible name exact,2px focus outline PASS |
| reduced motion | 원본 컴포넌트3크기에서 animation none·button transition0s PASS |
| 버튼 밀도·대비 | 가장큰버튼 실제폭/내용폭1.30배. 주 CTA흰글자 대비4.65:1,hover도 더높음 |

수치 [최종 geometry](evidence/final-geometry.json), [상호작용](evidence/interaction.json). UI 실행은 `apps/web`에서 PowerShell here-string을 `node --input-type=module`에 전달해 Playwright msedge headless로 수행했다. 실제 앱은 기존5000을 재사용했고 fixture는 Vite의 메모리 virtual module에 원본컴포넌트·전역CSS를 직접 import했다. fixture 서버는 종료했으며 새 파일/주소스위치/제품 진단코드/의존성을 추가하지 않았다. 실제 인증을 클릭하지 않고 fixture로 콜백·키보드를 검증했다.

## 공간·보존

667×275 본문 rect: 전306.81×200.66→후346.83×214.13px(뷰포트33.56%→40.49%). 두 레퍼런스의 브랜드/제목 강조를 폰에서 읽히게 하기 위한 증가이며 부제·CTA를 삭제하거나 글자를 축소하지 않았다. 하단 보조설명은 폰에서 숨겼고 버튼 bottom237.81px로 화면 안에 남는다. 1366×768 본문416×256.14→601.03×344.06px(10.16%→19.71%); 하단설명은 별도3열. 본문을 넘어 오른쪽 실제 지도 노출을 유지한다. safe-area·회전안내·동작줄이기 보존.

실행 전85개 기존 변경파일을 해시 기록, 허용된 인트로2파일과 Supervisor공용색인2파일을 제외한 **81파일 모두 SHA-256 동일**. 위치·브랜드·lint의 소스/시험·기존 문서·그림도 포함한다. 예상치 못한 tracked diff 추가0. [보존 근거](evidence/preservation.json). 제품 변경은 인트로2파일뿐이며 다른 작업 변경을 커밋·push하지 않았다.

## 한계·Chief 확인

PC 모바일 viewport 검증이며 실제 폰/회전중 브라우저UI/터치감·실OAuth·실주행·센서 검증은 미실시. 지도 실제 타일은 성공한 화면에서 검수했지만 네트워크/기기별 성능을 일반화하지 않는다. 배포 없음.

실행 폴더 `C:\20.HDev\boxcycle`. [로컬 앱](http://127.0.0.1:5000)을 새 시크릿창에서 열어 인트로를 확인한다. 로그인된 창은 인트로가 생략될 수 있다. 서버 재실행:

```powershell
Set-Location 'C:\20.HDev\boxcycle'
npm run dev -- --host 127.0.0.1 --port 5000 --strictPort
```
