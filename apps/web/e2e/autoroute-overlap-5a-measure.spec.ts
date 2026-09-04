import { test, expect, type Page } from '@playwright/test'

/**
 * 5A §2 재현 계측 — **원인 A(우리 우회 waypoint) vs B(provider 경로)** 를 가른다.
 *
 * 고치지 않는다. 서버 응답 원본(`outcome`·`directRoadMeters`·`detourCalls` …)과
 * geometry 를 그대로 파일로 떨어뜨린다. Chief 조건과 같게 **자동차 프로필 · 목표 0.7 km**
 * 로 강남 일방통행 구역을 여러 방향으로 클릭한다.
 */
const TARGET_KM = Number(process.env.OVERLAP_TARGET_KM ?? 0.7)
const OUT_PATH = process.env.OVERLAP_OUT ?? 'overlap-5a-samples.json'

async function enterAsGuest(page: Page) {
  await page.goto('/')
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible()
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden()
}

async function prepareManualRideInput(page: Page) {
  await page.getByRole('button', { name: /케이던스 센서/ }).click()
  const sheet = page.getByRole('dialog', { name: '케이던스 센서' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: '체험 속도로 준비' }).click()
  await sheet.getByRole('button', { name: '센서 설정 닫기' }).click()
  await expect(sheet).toBeHidden()
}

async function clickMap(page: Page, offsetX: number, offsetY: number) {
  const canvas = page.locator('canvas.mapboxgl-canvas').first()
  await expect(canvas).toBeVisible({ timeout: 60_000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('map canvas missing')
  await page.mouse.click(box.x + offsetX, box.y + offsetY)
  await page.waitForTimeout(400)
}

function pickSurface(page: Page) {
  return page.locator('.map-view__pick-dock-panel, .map-view__pick-popup').last()
}

async function openPickSurfaceAtStart(page: Page) {
  // Start 는 우하단에 둔다 — popup 이 Start 근처를 덮으므로 타깃은 좌·상 방향으로 찍는다.
  await clickMap(page, 900, 620)
  const popup = pickSurface(page)
  await expect(popup).toBeVisible({ timeout: 30_000 })
  await popup.getByRole('button', { name: 'Set start' }).evaluate((n) => n.click())
  await page.waitForTimeout(400)
  await popup.getByTestId('route-token-holding').waitFor({ state: 'visible', timeout: 30_000 })
  return popup
}

async function selectDrivingProfile(page: Page, popup: ReturnType<typeof pickSurface>) {
  const btn = popup.getByRole('button', { name: '자동차 경로' })
  await btn.waitFor({ state: 'visible', timeout: 15_000 })
  await btn.click()
  await page.waitForTimeout(300)
}

async function armDistanceDirectionMode(
  page: Page,
  popup: ReturnType<typeof pickSurface>,
  targetKm: number,
) {
  const modeCheckbox = popup.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' })
  await modeCheckbox.waitFor({ state: 'visible', timeout: 10_000 })
  if (!(await modeCheckbox.isChecked())) await modeCheckbox.check()
  const numberInput = popup.locator('.map-view__pick-distance-number')
  // Token 잔액이 로드되기 전에 arm 이 걸리면 「경로 토큰 부족」으로 실패하고 그대로 멈춘다.
  // 잔액이 실제로 1 이상으로 읽힐 때까지 기다린 뒤, arm 이 붙을 때까지 change 를 다시 던진다.
  await expect
    .poll(
      async () => {
        const t = await popup.getByTestId('route-token-holding').innerText().catch(() => '')
        const m = t.match(/(\d+)\s*개/)
        return m ? Number(m[1]) : -1
      },
      { timeout: 60_000, intervals: [300], message: 'Route Token 잔액 로드' },
    )
    .toBeGreaterThan(0)

  const hint = popup.getByText(/도착하고 싶은 도로 위 지점을 클릭|방향을 클릭/)
  const deadline = Date.now() + 60_000
  for (;;) {
    await numberInput.fill(String(targetKm))
    await numberInput.dispatchEvent('change')
    await page.waitForTimeout(600)
    if (await hint.isVisible().catch(() => false)) break
    if (Date.now() > deadline) {
      const status = await popup
        .locator('.map-view__pick-auto-route-status')
        .first()
        .innerText()
        .catch(() => '(상태 없음)')
      throw new Error(`거리·방향 arm 실패 — 상태 문구: ${status}`)
    }
  }
}

type Sample = {
  label: string
  offset: { x: number; y: number }
  requestTargetMeters?: number
  requestProfile?: string
  outcome?: string
  directRoadMeters?: number
  endMissMeters?: number
  detourCalls?: number
  algorithmVersion?: string
  distance?: number
  summary?: string
  /** 화면에 실제로 뜬 상태 문구 — §2.1 문구 모순 확인용 */
  statusText?: string
  offeredButtonText?: string | null
  sliderValue?: string | null
  coordinates?: [number, number][]
}

test.describe('5A §2 — 자동 Route 중복 구간 재현 계측', () => {
  test.describe.configure({ timeout: 600_000 })

  test('자동차 · 목표 0.7km · 강남 — outcome 과 geometry 를 그대로 떨어뜨린다', async ({ page }) => {
    const samples: Sample[] = []

    await enterAsGuest(page)
    await prepareManualRideInput(page)

    // Chief 조건과 같은 무대로 고정한다 — 강남 논현·역삼 일방통행 격자, z15.
    // z15·위도 37.5 에서 1 px ≈ 3.8 m 라, 아래 픽셀 오프셋이 0.5~1.0 km 직선거리에 대응한다.
    await page.waitForFunction(() => Boolean((window as { __RTW_MAP__?: unknown }).__RTW_MAP__), {
      timeout: 60_000,
    })
    await page.evaluate(() => {
      const m = (window as { __RTW_MAP__?: { jumpTo: (o: unknown) => void; stop: () => void } })
        .__RTW_MAP__!
      m.stop()
      m.jumpTo({ center: [127.0347, 37.5051], zoom: 15, pitch: 0, bearing: 0 })
    })
    await page.waitForTimeout(1_500)

    const popup = await openPickSurfaceAtStart(page)
    // 발견: 거리·방향 arm 뒤에 이동수단을 바꾸면 arm 이 풀린다(방향 클릭 안내가 사라진다).
    // 그래서 프로필을 먼저 고르고 arm 한다. arm 은 Token 잔액 로드까지 기다렸다 재시도한다.
    await selectDrivingProfile(page, popup)
    await armDistanceDirectionMode(page, popup, TARGET_KM)
    const appliedKm = await popup.locator('.map-view__pick-distance-number').inputValue()
    const appliedSlider = await popup.locator('input[type="range"]').first().inputValue().catch(() => null)
    console.log(`[5A] 목표 거리 적용값 number=${appliedKm} slider=${appliedSlider}`)

    // 방향을 여러 개 찍어 표본을 모은다 — 한 표본으로 A/B 를 단정하지 않는다.
    // 중심(420,320)에서 150~230 px = 약 0.57~0.87 km. 목표 0.7 km 와 겨루는 거리대라
    // exact / detoured 가 실제로 나온다(멀면 전부 offered 로 빠져 A/B 가 안 갈린다).
    const offsets = [
      { label: '서', x: 700, y: 620 },
      { label: '북', x: 900, y: 420 },
      { label: '북서', x: 760, y: 480 },
      { label: '서2', x: 660, y: 620 },
      { label: '북2', x: 900, y: 380 },
      { label: '북서2', x: 720, y: 440 },
    ]

    for (const o of offsets) {
      const respPromise = page.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          r.url().includes('getDistanceAutoRoute') &&
          r.ok(),
        { timeout: 120_000 },
      )
      await clickMap(page, o.x, o.y)
      const resp = await respPromise
      const req = resp.request().postDataJSON() as
        | { data?: { targetDistanceMeters?: number; profile?: string } }
        | null
      const body = await resp.json()
      const result = (body?.result ?? body) as Record<string, unknown>

      const surface = pickSurface(page)
      await surface
        .locator('.map-view__pick-auto-route-status')
        .first()
        .waitFor({ state: 'visible', timeout: 120_000 })
      await page.waitForTimeout(600)

      const statusText = await surface
        .locator('.map-view__pick-auto-route-status')
        .first()
        .innerText()
        .catch(() => '')
      const offeredBtn = surface.locator('.map-view__pick-auto-route-offered-btn')
      const offeredButtonText = (await offeredBtn.isVisible().catch(() => false))
        ? await offeredBtn.innerText()
        : null
      const sliderValue = await surface
        .locator('.map-view__pick-distance-number')
        .inputValue()
        .catch(() => null)

      const geometry = result.geometry as { coordinates?: [number, number][] } | undefined
      samples.push({
        label: o.label,
        offset: { x: o.x, y: o.y },
        requestTargetMeters: req?.data?.targetDistanceMeters,
        requestProfile: req?.data?.profile,
        outcome: result.outcome as string | undefined,
        directRoadMeters: result.directRoadMeters as number | undefined,
        endMissMeters: result.endMissMeters as number | undefined,
        detourCalls: result.detourCalls as number | undefined,
        algorithmVersion: result.algorithmVersion as string | undefined,
        distance: result.distance as number | undefined,
        summary: result.summary as string | undefined,
        statusText: statusText.trim(),
        offeredButtonText,
        sliderValue,
        coordinates: geometry?.coordinates,
      })

      console.log(
        `[5A] ${o.label.padEnd(3)} outcome=${String(result.outcome).padEnd(9)} ` +
          `directRoad=${Number(result.directRoadMeters ?? NaN).toFixed(1)}m ` +
          `dist=${Number(result.distance ?? NaN).toFixed(1)}m ` +
          `detourCalls=${result.detourCalls} endMiss=${Number(result.endMissMeters ?? NaN).toFixed(1)}m ` +
          `algo=${result.algorithmVersion} pts=${geometry?.coordinates?.length ?? 0}`,
      )
      console.log(`[5A] ${o.label} 문구: ${statusText.trim().replace(/\n/g, ' | ')}`)

      // 다음 방향을 찍으려면 다시 arm 해야 한다 — 결과 표시 상태에서는 클릭이 안 먹는다.
      await armDistanceDirectionMode(page, pickSurface(page), TARGET_KM).catch((e) => {
        console.log(`[5A] 재무장 실패(표본 중단): ${(e as Error).message}`)
        throw e
      })
    }

    await test.info().attach('overlap-5a-samples.json', {
      body: JSON.stringify({ targetKm: TARGET_KM, samples }, null, 2),
      contentType: 'application/json',
    })
    const fs = await import('node:fs')
    fs.writeFileSync(OUT_PATH, JSON.stringify({ targetKm: TARGET_KM, samples }, null, 2))
    console.log(`[5A] 표본 ${samples.length}건 → ${OUT_PATH}`)

    expect(samples.length).toBeGreaterThan(0)
  })
})
