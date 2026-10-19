# 최초 운영 고아 정리 — 2026-10-19

담당 Supervisor Codex. Chief 요청 범위로 운영 `boxcycle-dc2df` 개인 잔여 데이터만 정리했다. 운영 UID·원본 데이터·인증정보는 외부 Developer에게 전달하지 않았고 공개 문서에는 집계만 기록한다.

## 보호·사전 조사

- Auth 실제 조회: Google 4명 + Guest 1명(사용자 설명 이후 생긴 Guest). 5명 모두 보호, Auth 계정 삭제 없음.
- 사용자 귀속·공용 연결 컬렉션 2193문서와 RTDB trails 읽기 스냅샷. 상위 users가 없는 서브컬렉션도 조사.
- 최초 dry-run: Auth 없는 19 UID, Firestore 개인 문서17건(userPrivate1 + Trail 하위16), RTDB motion2건.
- 공용 Trail 개설자 참조112건(과거 UID 포함)은 기존 보존 계약대로 유지. dangling 참조가 모두 없어졌다는 의미가 아니며, 공용 Trail을 통삭제하지 않았다.

## 실행·검증

실행 폴더: `C:\20.HDev\boxcycle`

```powershell
Set-Location C:\20.HDev\boxcycle
node --test scripts/guest-orphan-maintenance.test.mjs
npm run admin:guest-orphans
npm run admin:guest-orphans -- --apply --project=boxcycle-dc2df --max=19
```

- 시험3건 PASS: 공용자료/현재 Auth 사용자 보호, users 없는 개인 데이터 탐지, 해시·프로젝트 불일치 방어.
- dry-run exit0. 첫 apply는 Firestore17 삭제, RTDB2 skip(서버 transaction 초깃값 null 처리). transaction CAS 재시도 조건 교정 후 같은 manifest로 재실행 exit0, RTDB2 삭제. 실패0.
- 삭제 직전 각 UID Auth 부재 재확인. Firestore 원본 해시 및 updateTime precondition, RTDB transaction hash 대조. 공유 문서/Auth 삭제 API 사용 없음.
- 독립 전후 대조 exit0: Auth UID 집합 동일, Google4/Guest1. 보호 개인문서1978건 해시 동일, 공용 Trail·공개경로192건 해시 동일. 조사 snapshot상 개인 고아0, RTDB motion 고아0.
- 공개 집계 증거: [summary](evidence/initial-cleanup-summary.json). 원본 snapshot/manifest/UID는 git 추적하지 않는 로컬 비공개 파일에만 보관.
- 이후 자동 정리·재생성 차단 Rules는 구현02에서 진행 중. 아직 이를 운영 적용 완료로 간주하지 않는다.
- 정리 후 최신 대상 재조회 `npm run admin:guest-orphans` exit0: 대상 UID0/Firestore0/RTDB0. 도구는 현재 존재 여부·원본 해시를 다시 대조하며, 이미 지운 snapshot 경로를 잔여로 재보고하지 않는다.
- 안전장치 보강 후 시험5건 PASS, `node scripts/check-dev-tools.mjs --check` PASS/WARN0. RTDB transaction의 uncached null·동시 변경 abort 및 다른 프로젝트 URL 거부를 추가 검증했다.
- Auth 설정 읽기 확인: subtype=FIREBASE_AUTH, autodeleteAnonymousUsers=false ([증거](evidence/auth-config-summary.json)). 생성일 기준 Firebase 자동 삭제와 새 미사용30일 정책의 이중 적용은 현재 없다. 설정 변경 없음.

## 도구 사용 범위

`admin:guest-orphans`는 사전 snapshot에 기반한 정확한 manifest만 처리한다. 최신 전체 census 수집 기능은 없으므로 오래된 snapshot으로 신규 고아까지 정리했다고 주장하지 않는다. 재실행 시 snapshot 갱신 필요. 기본 dry-run, 명시 프로젝트/처리 cap 필요, Google4의 UID 집합이 사전 목록과 달라지면 중단. 현재 Auth에 존재하는 계정은 Guest라도 보호한다.
