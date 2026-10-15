$contractPath39 = 'C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle/apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts'
$contract39 = Get-Content -LiteralPath $contractPath39 -Raw
$old39 = '    assert.match(stepBlock, /if \(!distanceDirectionChecked\) return/);'
$new39 = @'
    assert.match(stepBlock, /if \(!ensureDistanceDirectionForInput\(\)\) return/);
    const activationBlock = BUILD_PICK_POPUP_SOURCE.slice(
      BUILD_PICK_POPUP_SOURCE.indexOf("function ensureDistanceDirectionForInput"),
      BUILD_PICK_POPUP_SOURCE.indexOf("function applyDistanceDirectionMode"),
    );
    assert.match(activationBlock, /!pins\.start/);
    assert.match(activationBlock, /setDistanceDirectionMode\?\.\(true\)/);
    assert.doesNotMatch(activationBlock, /fetchDistanceAutoRoute|onAutoRouteMapPick/);
'@
if (-not $contract39.Contains($old39)) { throw 'Expected step guard contract not found' }
$contract39 = $contract39.Replace($old39,$new39)
Set-Content -LiteralPath $contractPath39 -Value $contract39 -NoNewline
$e2ePath39 = 'C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle/apps/web/e2e/ride-summary-compact.spec.ts'
$e2e39 = Get-Content -LiteralPath $e2ePath39 -Raw
$e2e39 = $e2e39.Replace('「거리」 체크박스가 자동 End 세션을 끝낸다','위치 컨트롤 선택이 거리 방향 대기를 끝낸다')
$old39 = '    await dock.getByRole("button", { name: "위치 선택으로 돌아가기" }).click();'
$new39 = @'
    await dock.getByRole("button", { name: "위치 선택 컨트롤 펼치기" }).click();
    await expect(locationView, "캐럿은 위치 컨트롤을 위에 붙인다").toBeVisible();
    await expect(distanceView, "위치를 펼쳐도 거리 내용은 유지된다").toBeVisible();
    await expect(hint, "펼치기만으로 거리 대기를 해제하지 않는다").toBeVisible();
    await dock.getByRole("button", { name: "Set start", exact: true }).click();
'@
if (-not $e2e39.Contains($old39)) { throw 'Expected text return button not found' }
$e2e39 = $e2e39.Replace($old39,$new39)
$e2e39 = $e2e39.Replace('    await expect(distanceView).toBeHidden();','    await expect(distanceView, "위치 조작 후에도 펼친 거리 컨트롤을 유지한다").toBeVisible();')
Set-Content -LiteralPath $e2ePath39 -Value $e2e39 -NoNewline
