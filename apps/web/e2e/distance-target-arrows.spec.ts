import { test, expect } from '@playwright/test';
import { stubMapboxStyle } from './mapbox-stub';

test('거리 안내 화살표: 세 화면·거리 변경·스타일 차분/전체 전환·제거/재진입', async ({ page }) => {
  test.setTimeout(60_000);
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/, r => r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  // 제품에 시험 API를 추가하지 않고 기존 실제 MapView fixture의 props만 주입한다.
  await page.route(/\/scripts\/ui-800x360\/map-route-runtime\.tsx/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    expect(body).toContain('export function Runtime() {');
    expect(body).toContain('distanceTargetCircle: circle,');
    body = 'import {circleLineString as auditCircleLineString} from "/src/lib/route/distanceAutoRoute.ts";\n' + body;
    body = body.replace('export function Runtime() {', 'export function Runtime() { const [auditCircle,setAuditCircle]=useState(auditCircleLineString([127,37],5000)); window.__auditSetCircle=setAuditCircle;');
    body = body.replace('distanceTargetCircle: circle,', 'distanceTargetCircle: auditCircle,');
    await route.fulfill({response,body});
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/scripts/ui-800x360/map-route-runtime.html');
  const count = () => page.evaluate(() => {
    // MapView의 기존 검수용 Map 참조.
    // @ts-expect-error fixture global
    return window.__RTW_MAP__?.getSource('distance-target-circle-arrows')?._data.features.length ?? 0;
  });
  await expect.poll(count).toBe(12);
  for (const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]) {
    await page.setViewportSize(size);
    await expect.poll(count).toBe(12);
  }
  for (const radius of [1000,120000]) {
    await page.evaluate(async radius => {
      const url = '/src/lib/route/distanceAutoRoute.ts';
      const {circleLineString} = await import(url);
      // @ts-expect-error fixture global
      window.__auditSetCircle(circleLineString([179.99,37],radius));
    }, radius);
    await expect.poll(() => page.evaluate(() => {
      // @ts-expect-error fixture global
      return window.__RTW_MAP__.getSource('distance-target-circle-arrows')._data.features[0].geometry.coordinates[0][1][1];
    })).toBeGreaterThan(radius === 1000 ? 37 : 38);
    await expect.poll(count).toBe(12);
  }
  for (const diff of [true,false]) {
    await page.evaluate(diff => {
      // @ts-expect-error fixture global
      window.__RTW_MAP__.setStyle({version:8,sources:{},layers:[]},{diff});
    }, diff);
    await expect.poll(count).toBe(12);
  }
  await page.evaluate(() => {
    // @ts-expect-error fixture global
    window.__auditSetCircle(null);
  });
  await expect.poll(count).toBe(0);
  await page.evaluate(async () => {
    const url = '/src/lib/route/distanceAutoRoute.ts';
    const {circleLineString} = await import(url);
    // @ts-expect-error fixture global
    window.__auditSetCircle(circleLineString([127,37],5000));
  });
  await expect.poll(count).toBe(12);
  expect(errors).toEqual([]);
});
