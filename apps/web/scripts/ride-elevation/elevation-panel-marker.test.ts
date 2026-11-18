import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildElevationUi } from '../../src/components/map/mapElevationUi.ts';

test('표고 현재 값은 위치점과 같은 보간 비율을 사용한다', () => {
  const ui = buildElevationUi([10, 20, 30], 0.25, 1000);
  assert.equal(ui.marker?.elevationMeters, 15);
  assert.equal(ui.marker?.progressPct, 25);
  assert.equal(ui.marker?.x, '109.00');
});
test('경로 양끝과 음수 표고를 보존하고 위치 없음을 0으로 바꾸지 않는다', () => {
  assert.equal(buildElevationUi([-10, 0, 10], -1, 1000).marker?.elevationMeters, -10);
  assert.equal(buildElevationUi([-10, 0, 10], 2, 1000).marker?.elevationMeters, 10);
  assert.equal(buildElevationUi([-10, 0, 10], null, 1000).marker, null);
  for (const ratio of [0, .5, 1]) {
    const marker = buildElevationUi([-100, 1500, 0], ratio, 20000).marker!;
    assert.ok(marker.yPct >= 24 && marker.yPct <= 76);
  }
});

test('출발·도착 마커 좌표가 표고선의 실제 양끝과 일치한다', () => {
  for (const values of [[-100, 1500, 0], [1500, 0, -100], [42, 42, 42]]) {
    const ui=buildElevationUi(values,.5,20000);
    const points=ui.polylinePoints.split(' ').map(point=>point.split(',').map(Number));
    assert.ok(Math.abs(ui.startPoint.xPct/100*420-points[0][0])<.01);
    assert.ok(Math.abs(ui.startPoint.yPct-points[0][1])<.01);
    assert.ok(Math.abs(ui.endPoint.xPct/100*420-points.at(-1)![0])<.01);
    assert.ok(Math.abs(ui.endPoint.yPct-points.at(-1)![1])<.01);
  }
});
