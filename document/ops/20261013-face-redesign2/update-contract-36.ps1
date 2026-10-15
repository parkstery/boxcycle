$contractPath36 = 'C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle/apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts'
$contract36 = Get-Content -LiteralPath $contractPath36 -Raw
$contract36 = $contract36.Replace('3D-2 — 이동수단과 경로 삭제가 같은 action row', '경로 탐색 화면 — 경로 삭제는 두 모드의 공통 제목 영역')
$old36 = '    assert.match(BUILD_PICK_POPUP_SOURCE, /rowProfile\.appendChild\(clearRouteBtn\)/);'
$new36 = @'
    assert.match(BUILD_PICK_POPUP_SOURCE, /headerRow\.append\(clearRouteBtn\)/);
    assert.match(BUILD_PICK_POPUP_SOURCE, /dragHandle\.append\(headerRow, addressEl, metaEl\)/);
    assert.doesNotMatch(BUILD_PICK_POPUP_SOURCE, /rowProfile\.appendChild\(clearRouteBtn\)/);
'@
if (-not $contract36.Contains($old36)) { throw 'Expected clear-route contract was not found' }
$contract36 = $contract36.Replace($old36,$new36)
Set-Content -LiteralPath $contractPath36 -Value $contract36 -NoNewline
$e2ePath36 = 'C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle/apps/web/e2e/ride-summary-compact.spec.ts'
$e2e36 = Get-Content -LiteralPath $e2ePath36 -Raw
$old36 = @'
    const distanceToggle = dock.getByRole("checkbox", { name: "거리와 방향으로 Route 찾기" });
    await expect(distanceToggle, "들어오면 「거리」가 켜져 있다").toBeChecked();
'@
$new36 = @'
    const distanceView = dock.locator(".map-view__pick-auto-route");
    const locationView = dock.locator(".map-view__pick-route-view--location");
    await expect(distanceView, "들어오면 거리 탐색 화면이다").toBeVisible();
    await expect(locationView, "거리 탐색 중 위치 컨트롤은 숨긴다").toBeHidden();
'@
$old36 = $old36.Replace("`n","`r`n")
$new36 = $new36.Replace("`n","`r`n")
if (-not $e2e36.Contains($old36)) { throw 'Expected old distance checkbox flow was not found' }
$e2e36 = $e2e36.Replace($old36,$new36)
$e2e36 = $e2e36.Replace('    await distanceToggle.uncheck();','    await dock.getByRole("button", { name: "위치 선택으로 돌아가기" }).click();')
$e2e36 = $e2e36.Replace('    await expect(distanceToggle).not.toBeChecked();', '    await expect(locationView).toBeVisible();' + "`r`n" + '    await expect(distanceView).toBeHidden();')
$e2e36 = $e2e36.Replace('const endBtn = afterClick.getByRole("button", { name: "End" });','const endBtn = afterClick.getByRole("button", { name: "Set end", exact: true });')
Set-Content -LiteralPath $e2ePath36 -Value $e2e36 -NoNewline
