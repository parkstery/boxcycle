# Quick Camera 릴레이 — 20260924-camera-qc

> **감리(클로드)와 개발팀장(커서)이 이 폴더의 파일로만 통신한다.**
> 규약은 [`20260923-first_ride/README.md`](../20260923-first_ride/README.md) 를 **그대로 승계**한다
> (파일명·수신·보고·커밋 금지·검증 예산). 여기서는 다른 점만 적는다.

## 1. 이 묶음

**Quick Camera 1~6 의 후속.** 이전 카메라 묶음 [`20260922-new_camera`](../20260922-new_camera/README.md) 는 종결됐고,
그때 확정된 값(pitch 80° · 거리 상한 60 / 기본 40 / 하한 6.0m · 명칭 `forward/backward/left/right`)은
**그대로 유효하다.** 되돌리지 마라.

## 2. 수신 (실행 폴더: `C:\20.HDev\boxcycle`)

```bash
node scripts/ops-relay/await-next.mjs document/ops/20260924-camera-qc
node scripts/ops-relay/check-amend.mjs document/ops/20260924-camera-qc   # 진행 로그 쓸 때마다
```

파일명은 `20260924-지시NN-*.md` / `20260924-지시NN수행결과-*.md`.

## 3. 이 묶음에서도 그대로인 것

- `git commit`·`git push`·배포 **금지** — 감리가 판정 후 처리한다
- 한 라운드 = **화면 변화 하나**
- 캡처 없는 보고는 반려. **카메라는 그림이 곧 증거다**
- `PROGRESS.md` **UTF-8**, 10분에 한 줄
- 같은 수정 3회 실패 → 멈추고 감리에 올려라
- **UI 공간 밀도 원칙**([D1~D7](../../260924-RTW-UI-공간밀도-원칙.md))이 자동 적용된다

## 4. 요구의 기준

| 문서 | 역할 |
|---|---|
| [결정 로그](../../260707-RTW-결정-로그.md) 2026-09-23 `[Map][UI]` 줄들 | pitch·거리·명칭 확정값 |
| [Quick Camera 완료보고](../../archive/260923-RTW-Quick-Camera-작업-완료보고서.md) | 1~6 의 현재 동작 |
| [UI 공간 밀도 원칙](../../260924-RTW-UI-공간밀도-원칙.md) | 버튼·라벨 |
