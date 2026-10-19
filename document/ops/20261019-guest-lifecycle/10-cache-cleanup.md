# 추가 개인 경로 캐시 최초 정리

수행 Codex Supervisor, 2026-10-19. Chief의추가고아정리승인범위. 원본/UID/manifest는 .out/private-guest-lifecycle/cache-cleanup에만보관(외부전송금지).

- 읽기전수: routeAutoRouteCache444개중Auth없는77UID의196문서. 현재Auth8명(Google4+Guest4)은전원보호. 초기스냅샷에는이컬렉션없어서추가조사.
- 도구 guest-orphan-maintenance.mjs에 routeAutoRouteCache.userId 개인귀속추가. 별도snapshot·dry-run manifest196 검수. 같은도구5단위PASS.
- apply: 대상별freshAuth부재재확인+해시+Firestore updateTimeprecondition, max196/project명시. deleted196/skippedChanged0/failures0. Auth삭제없음·공용자료변경없음.
- 사후읽기: 대상잔여0/보호248문서삭제0·해시변경0/Google4동일/전체Auth8보존. evidence/cache-cleanup-verification.json.

cwd C:\20.HDev\boxcycle

```powershell
Set-Location C:\20.HDev\boxcycle
node scripts/guest-orphan-maintenance.mjs --dir=.out/private-guest-lifecycle/cache-cleanup
node scripts/guest-orphan-maintenance.mjs --dir=.out/private-guest-lifecycle/cache-cleanup --apply --project=boxcycle-dc2df --max=196
node scripts/guest-cache-preservation-supervisor.mjs
```

위apply는이미실행됨. 재실행은현재manifest/timestamp/보호검사로제한된다. 이후새고아수집은검증된서버sweep경로를배포한뒤담당. 이번누적정리FS213(기존17+cache196)/RTDB2. 보존중인사용자활동값을초기값으로복원하지않음.
