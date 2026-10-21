# 경로 패널 정리 Git 검수

2026-10-22 · record · MERGED_AND_PUSHED / 미배포.

제품 `5b6cc8a4` 작업브랜치 push 및 main2 병합/푸시 모두 exit0. main2 push 게이트 전체 단위1335 PASS/0FAIL(80.4s), selector19/타입/동행재생/의존성/개발부산물 PASS. 커밋pre-commit lint PASS. 이번 작업 브랜치만 병합 후 삭제하며 기존 main/codex/new-road-display-release/fix/pre-ui-release-20261020는 유지한다.

남은 dirty는 기존 공용 ops2파일 및 .out/cdbox/이전evidence/patch. 제품 미커밋 변경0. 운영 배포는 요청되지 않아 릴리스18 유지. 로컬 검수서버 종료 상태,3000 유지.

필요 시 로컬 확인:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

http://127.0.0.1:5002 → 지도 길게누르기 → 출발·도착/거리·방향 탭에서 보조설명 제거 확인. 현재 서버가 실행 중이라는 뜻은 아니다.
