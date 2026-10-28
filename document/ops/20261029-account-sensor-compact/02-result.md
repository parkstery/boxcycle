# 결과·검수 — 실제 제품 창 축소

2026-10-29 Codex. 로컬 검증 완료·미커밋·미푸시·미배포.

## 변경

- UserInfoSheet.css: 740×324→520×250px, 왼쪽268→164px, 거리42px/긴수치34px, 기간26px·도로망26px·상세29px·하단28px. 기존 팔레트와 기능 유지.
- 좁은 세로 화면은 단일 열, 최근 기록은 같은 창에서 펼치고 목록 스크롤.
- CadenceSensorSheet.css: 560→420px, 왼쪽39%→30%, 고정 최소높이 제거, 여백·제목·버튼·속도숫자 축소.
- 800×360에서 체험속도420×211.16, 센서연결420×131.5, 단절420×134.27, 미지원420×226.55px. 안내·상태에 따라 높이가 달라진다.
- 이전 계정 작업은 시안 단계라 제품이740×324로 남아 있었다. 이번에 제품 반영 완료. 행동/콜백/데이터 변경 없음.

## 검증

- 웹 `npm run build`: PASS(TypeScript 포함), 기존 큰 번들 경고.
- 실제 제품 컴포넌트5크기×5상태:25 PASS, 화면경계/가로넘침/조작부잘림0.
- 각 크기에서 최근 주행3개 인라인 펼침·접기, 속도35직접입력→증가36→감소35 PASS.
- `git diff --check` PASS, 최종PNG 눈검수 PASS.
- Ego space11 DOM측정 성공. 캡처는CDP timeout/fromSurface:false 검정화면 실패. 별도 headless Chromium에서25상태·정상캡처 검증 후 space11 종료. 최초 실패는 성공으로 세지 않았다.
- 실폰/실회원데이터/실센서/운영Firebase 미검증. 기존 in-memory preview 사용. 기능로직 변경 없어 서버 시험 재실행하지 않았다.

증거: [측정JSON](evidence/compact-qa.json), [주행기록](evidence/compact-records.png), [체험속도](evidence/compact-speed.png).

## 확인

기존5031 서버 재사용. 없으면:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

http://localhost:5031/ 새로고침 → 계정/주행 기록 또는 센서 → 체험 속도.
저장 없는 검수: `/scripts/ui-800x360/preview.html?state=account&historyPreview=1` 및 `?state=sensor-riding-manual`.
운영 반영은 별도 Hosting 배포 필요. 다른 작업의 dirty파일·산출물·기존서버 유지.
