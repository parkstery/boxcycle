import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const preview = '/scripts/ui-800x360/preview.html';

const sizes = [
  { width: 800, height: 360 },
  { width: 667, height: 300 },
  { width: 844, height: 390 },
];

function parsePx(value: string): number {
  return Number.parseFloat(value) || 0;
}

async function shot(page: import('@playwright/test').Page, name: string, w: number, h: number) {
  if (!process.env.BATCH3_EVIDENCE_DIR) return;
  const dir = process.env.BATCH3_EVIDENCE_DIR;
  await fs.mkdir(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${name}-${w}x${h}.png`),
    animations: 'disabled',
  });
}

for (const size of sizes) {
  test(`주행 결과 판 레이아웃·숫자·저장 ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=summary`);
    const sheet = page.getByRole('region', { name: '주행 결과', exact: true });
    await expect(sheet).toBeVisible();
    // 위치 판정은 진입 애니메이션(translateY 16px → 0)이 끝난 최종 화면에서 한다.
    await sheet.locator('.ride-summary__sheet').evaluate(async element => {
      await Promise.all(element.getAnimations().map(animation => animation.finished));
    });
    const box = await sheet.locator('.ride-summary__sheet').boundingBox();
    expect(box).not.toBeNull();
    // Chief 10-26: 종전 740×324 의 60%(444×194)
    expect(box!.width).toBeGreaterThanOrEqual(Math.min(440, size.width - 24));
    expect(box!.width).toBeLessThanOrEqual(445);
    expect(box!.height).toBeGreaterThanOrEqual(190);
    expect(box!.height).toBeLessThanOrEqual(198);
    // 줄인 판에서 글자가 넘쳐 잘리거나 스크롤로 숨지 않는다(D5)
    for (const col of ['.ride-summary__col--primary', '.ride-summary__col--detail']) {
      const overflow = await sheet.locator(col).evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(overflow, `${col} 넘침`).toBeLessThanOrEqual(1);
    }
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);

    const headline = sheet.locator('.ride-summary__story-headline').first();
    await expect(headline).toBeVisible();
    const headlineSize = parsePx(await headline.evaluate((el) => getComputedStyle(el).fontSize));
    expect(headlineSize).toBeGreaterThanOrEqual(10);
    expect(headlineSize).toBeLessThanOrEqual(11);

    const title = sheet.locator('#ride-summary-title');
    const titleSize = parsePx(await title.evaluate((el) => getComputedStyle(el).fontSize));
    expect(titleSize).toBeGreaterThanOrEqual(11);

    const timeRow = sheet.locator('.ride-summary__substat').filter({ hasText: '시간' }).first();
    await expect(timeRow).toBeVisible();
    const rowBox = await timeRow.boundingBox();
    const detailCol = sheet.locator('.ride-summary__col--detail');
    const detailBox = await detailCol.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(detailBox).not.toBeNull();
    expect(rowBox!.width).toBeGreaterThanOrEqual(detailBox!.width * 0.85);

    const conquestHero = sheet.locator('.ride-summary__conquest-hero');
    if ((await conquestHero.count()) > 0) {
      const heroBg = await conquestHero.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(heroBg).toBe('rgba(0, 0, 0, 0)');
    }

    await expect(sheet.locator('.ride-summary__progress')).toHaveAttribute('data-ridden-km', /^\d+\.\d{2}$/);
    await expect(sheet.locator('.ride-summary__progress')).toHaveAttribute('data-total-km', '5.00');
    await expect(sheet.getByText('시간', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: '내 경로로 저장' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: '저장 안 함' })).toBeVisible();
    await expect(sheet.locator('.ride-summary__close')).toHaveCount(0);
    await shot(page, 'after-summary', size.width, size.height);
  });
}

test('경로명은 주소 텍스트처럼 보이고 모든 화면에서 저장 버튼 윗줄에 유지된다', async ({ page }) => {
  for (const size of [{width:1770,height:800},{width:1015,height:458},{width:800,height:360},
    {width:699,height:273},{width:667,height:300},{width:390,height:844}]) {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=summary`);
    const sheet = page.getByRole('region', {name:'주행 결과',exact:true});
    const input = sheet.getByRole('textbox', {name:'저장할 경로 이름',exact:true});
    for (const name of ['일본 후쿠오카현 후쿠오카시', '일본 후쿠오카현 후쿠오카시 히가시구 箱崎ふ頭4丁目2番1']) {
      await input.fill(name);
      await input.press('Tab');
      await expect(input).toHaveValue(name);
      await expect(input).toHaveAttribute('title',name);
      const geometry = await sheet.evaluate(el=>{
        const input=el.querySelector('.ride-summary__input')!;
        const row=el.querySelector('.ride-summary__form-btns')!;
        const detail=el.querySelector('.ride-summary__col--detail')!;
        const a=input.getBoundingClientRect(),b=row.getBoundingClientRect(),c=detail.getBoundingClientRect();
        const style=getComputedStyle(input);
        return {input:a.toJSON(),buttons:b.toJSON(),detail:c.toJSON(),border:style.borderTopWidth,
          background:style.backgroundColor,radius:style.borderRadius,overflow:detail.scrollHeight-detail.clientHeight};
      });
      expect(geometry.input.bottom).toBeLessThanOrEqual(geometry.buttons.top+1);
      expect(geometry.input.left).toBeGreaterThanOrEqual(geometry.detail.left-1);
      expect(geometry.input.right).toBeLessThanOrEqual(geometry.detail.right+1);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.border).toBe('0px');
      expect(geometry.background).toBe('rgba(0, 0, 0, 0)');
      expect(geometry.radius).toBe('0px');
    }
    await shot(page,'address-above-save',size.width,size.height);
    await sheet.getByRole('button',{name:'내 경로로 저장',exact:true}).click();
    await expect(sheet).not.toBeVisible();
  }
});

test('주행 결과 저장 중·진행률 실패 문구와 닫기', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=summary&variant=saving`);
  let sheet = page.getByRole('region', { name: '주행 결과', exact: true });
  await expect(sheet.getByText('주행 저장 중…', { exact: true })).toBeVisible();
  await page.goto(`${preview}?state=summary&variant=progress-fail`);
  sheet = page.getByRole('region', { name: '주행 결과', exact: true });
  await expect(sheet.getByText('⚠ 진행률 저장 실패', { exact: true })).toBeVisible();
  await page.goto(`${preview}?state=summary&variant=closed`);
  sheet = page.getByRole('region', { name: '주행 결과', exact: true });
  await expect(sheet.locator('.ride-summary__close')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '저장 안 함' })).toHaveCount(0);
});

for (const size of sizes) {
  // Chief 10-26 화면: 게스트 안내·칼로리 설정·저장 줄이 한꺼번에 있어도 60% 판 안에 든다
  test(`주행 결과 60% 판에 게스트 안내·저장이 함께 든다 ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=summary&variant=guest-full`);
    const sheet = page.getByRole('region', { name: '주행 결과', exact: true });
    await expect(sheet.getByRole('button', { name: 'Google 연결', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: '체중·체력 설정', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: '저장 안 함' })).toBeVisible();
    for (const col of ['.ride-summary__col--primary', '.ride-summary__col--detail']) {
      const overflow = await sheet.locator(col).evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(overflow, `${col} 넘침`).toBeLessThanOrEqual(1);
    }
    await shot(page, 'after-summary-guest-full', size.width, size.height);
  });
}

test('게스트 기록 보호 안내와 Google 연결', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=glance-summary`);
  const sheet = page.getByRole('region', { name: '주행 결과', exact: true });
  await expect(sheet.getByRole('group', { name: '기록 지키기' })).toBeVisible();
  await expect(sheet.getByRole('group', { name: '기록 지키기' })).not.toContainText('로그아웃하면 사라');
  await expect(sheet.getByRole('button', { name: 'Google 연결', exact: true })).toBeVisible();
  await expect(sheet.locator('.ride-summary__close')).toBeVisible();
});

for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }]) {
  test(`다음 주행 이어달리기·남은 거리 ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=nextride-resume`);
    const fixture = page.locator('#batch3-next-ride-fixture');
    const card = fixture.locator('.next-ride-anchor');
    await expect(card).toBeVisible();
    await expect(fixture.getByRole('group', { name: '다음 주행', exact: true })).toBeVisible();
    await expect(card.getByText('멈춘 곳', { exact: true })).toBeVisible();
    await expect(card.getByText('남은 거리', { exact: true })).toBeVisible();
    await expect(card.getByText('다음 주행 이어가기')).toHaveCount(0);

    const title = card.locator('#next-ride-title');
    const titleSize = parsePx(await title.evaluate((el) => getComputedStyle(el).fontSize));
    expect(titleSize).toBeGreaterThanOrEqual(16);

    const remaining = card.locator('.next-ride__fact-value--accent').first();
    const remainingSize = parsePx(await remaining.evaluate((el) => getComputedStyle(el).fontSize));
    expect(remainingSize).toBeGreaterThanOrEqual(20);

    const cardBox = await card.locator('.next-ride__card').boundingBox();
    expect(cardBox!.width).toBeGreaterThanOrEqual(280);
    expect(cardBox!.width).toBeLessThanOrEqual(340);

    const btnBoxes = await card.locator('.next-ride__btn').evaluateAll((nodes) =>
      nodes.map((n) => n.getBoundingClientRect()),
    );
    const maxBtnBottom = Math.max(...btnBoxes.map((r) => r.bottom));
    const minBtnTop = Math.min(...btnBoxes.map((r) => r.top));
    expect(maxBtnBottom - minBtnTop).toBeLessThanOrEqual(48);

    const resume = card.getByRole('button', { name: /%에서 이어 달리기/ });
    await resume.click();
    await expect(fixture).toHaveAttribute('data-resume-calls', '1');
    await expect(fixture).toHaveAttribute('data-extend-calls', '0');

    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(size.width + 1);
    await shot(page, 'after-nextride-resume', size.width, size.height);
  });
}

test('다음 주행 끝점 연장·지도 보기·숨기기', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=nextride-extend`);
  const fixture = page.locator('#batch3-next-ride-fixture');
  const card = fixture.locator('.next-ride-anchor');
  await expect(card.getByRole('button', { name: '여기에서 계속', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: '지도에서 보기', exact: true })).toBeVisible();
  await card.getByRole('button', { name: '지도에서 보기', exact: true }).click();
  await expect(fixture).toHaveAttribute('data-map-calls', '1');
  await card.getByRole('button', { name: '다음 주행 숨기기', exact: true }).click();
  await expect(fixture).toHaveAttribute('data-dismiss-calls', '1');
  await expect(fixture.locator('.next-ride-anchor')).toHaveCount(0);
  await shot(page, 'after-nextride-extend', 800, 360);
});

test('다음 주행 긴 지명은 말줄임으로 겹치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 300 });
  await page.goto(`${preview}?state=nextride-extend&long`);
  const card = page.locator('.next-ride-anchor');
  await expect(card.getByText('마지막 종료 지점', { exact: true })).toHaveCount(0);
  const place = card.locator('.next-ride__line--strong');
  await expect(place).toBeVisible();
  const overflow = await place.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, scroll: el.scrollWidth, cardW: el.closest('.next-ride__card')?.getBoundingClientRect().width ?? 0 };
  });
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.cardW + 2);
});
