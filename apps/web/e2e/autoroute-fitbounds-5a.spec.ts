import { test, expect, type Page } from '@playwright/test'

/**
 * 5A-R1 §4.1 계측 — 거리 원 자동 축척(fitBounds)이 폰 뷰포트에서 왜 안 먹는가.
 *
 * 후보 1(padding 이 뷰포트를 잡아먹음) · 2(팝업이 지도를 덮음) · 3(maxZoom 16 상한)
 * 중 어느 것인지 **측정으로 가른다.** 고치지 않는다.
 *
 * 같은 bounds·같은 옵션으로 뷰포트만 바꿔 fitBounds 전후 zoom 을 잰다.
 */
const SAFE_PADDING = { top: 52, bottom: 120, left: 44, right: 44 }
const CENTER: [number, number] = [127.0347, 37.5051]

async function enterAsGuest(page: Page) {
  await page.goto('/')
  const gate = page.getByRole('dialog', { name: '시작' })
  await expect(gate).toBeVisible()
  await gate.getByRole('button', { name: '시작', exact: true }).click()
  await expect(gate).toBeHidden()
  await page.waitForFunction(() => Boolean((window as { __RTW_MAP__?: unknown }).__RTW_MAP__), {
    timeout: 60_000,
  })
}

const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 900 },
  { label: 'phone-portrait', width: 390, height: 844 },
  { label: 'phone-landscape', width: 844, height: 390 },
  { label: 'phone-small', width: 360, height: 640 },
  { label: 'phone-landscape-small', width: 667, height: 320 },
]

test.describe('5A-R1 §4.1 — 거리 원 fitBounds 뷰포트 계측', () => {
  test.describe.configure({ timeout: 300_000 })

  for (const targetKm of [0.7, 3]) {
    test(`목표 ${targetKm}km 원 · 뷰포트별 fitBounds`, async ({ page }) => {
      await enterAsGuest(page)

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.waitForTimeout(600)
        const r = await page.evaluate(
          ({ center, radiusKm, padding }) => {
            const m = (window as unknown as {
              __RTW_MAP__: {
                getZoom: () => number
                getCenter: () => { lng: number; lat: number }
                getContainer: () => HTMLElement
                jumpTo: (o: unknown) => void
                stop: () => void
                fitBounds: (b: unknown, o: unknown) => void
                resize: () => void
              }
            }).__RTW_MAP__
            m.resize()
            m.stop()
            m.jumpTo({ center, zoom: 12, pitch: 0, bearing: 0 })
            const el = m.getContainer()
            const w = el.clientWidth
            const h = el.clientHeight
            const before = m.getZoom()
            // 반지름 radiusKm 원의 bounds
            const dLat = (radiusKm * 1000) / 111_320
            const dLng = dLat / Math.cos((center[1] * Math.PI) / 180)
            const bounds = [
              [center[0] - dLng, center[1] - dLat],
              [center[0] + dLng, center[1] + dLat],
            ]
            // 제품과 같은 축소 규칙(resolveRideFitPadding)을 여기서 재현해 전후를 함께 잰다.
            const scaleAxis = (a: number, b: number, extent: number) => {
              const sum = a + b
              if (!(extent > 0) || sum <= 0) return 1
              const max = extent * 0.4
              return sum <= max ? 1 : max / sum
            }
            const sy = scaleAxis(padding.top, padding.bottom, h)
            const sx = scaleAxis(padding.left, padding.right, w)
            const scaled = {
              top: Math.floor(padding.top * sy),
              bottom: Math.floor(padding.bottom * sy),
              left: Math.floor(padding.left * sx),
              right: Math.floor(padding.right * sx),
            }
            let threw: string | null = null
            try {
              m.fitBounds(bounds, { padding, maxZoom: 16, duration: 0, essential: true })
            } catch (e) {
              threw = (e as Error).message
            }
            const zoomFixed = m.getZoom()
            m.stop()
            m.jumpTo({ center, zoom: 12, pitch: 0, bearing: 0 })
            try {
              m.fitBounds(bounds, { padding: scaled, maxZoom: 16, duration: 0, essential: true })
            } catch { /* noop */ }
            const zoomScaled = m.getZoom()
            return {
              containerW: w,
              containerH: h,
              usableW: w - padding.left - padding.right,
              usableH: h - padding.top - padding.bottom,
              zoomBefore: before,
              zoomAfter: zoomFixed,
              zoomScaled,
              scaled,
              threw,
            }
          },
          { center: CENTER, radiusKm: targetKm, padding: SAFE_PADDING },
        )
        console.log(
          `[5A-fit] ${targetKm}km ${vp.label.padEnd(21)} ${String(vp.width).padStart(4)}x${String(vp.height).padStart(3)} ` +
            `container ${r.containerW}x${r.containerH} usable ${r.usableW}x${r.usableH} ` +
            `zoom 고정 ${r.zoomAfter.toFixed(2)} → 축소 ${r.zoomScaled.toFixed(2)} ` +
            `(padding ${r.scaled.top}/${r.scaled.bottom}/${r.scaled.left}/${r.scaled.right}) ` +
            `${r.zoomAfter >= 15.99 ? '(maxZoom 16 상한)' : ''}${r.threw ? ` THREW: ${r.threw}` : ''}`,
        )
      }
      expect(true).toBe(true)
    })
  }
})

test.describe('5A-R1 §4.1 후보 2 — 팝업이 지도를 얼마나 덮는가', () => {
  test.describe.configure({ timeout: 300_000 })

  for (const vp of VIEWPORTS) {
    test(`${vp.label} — pick 표면 점유율`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await enterAsGuest(page)
      await page.evaluate((center) => {
        const m = (window as unknown as { __RTW_MAP__: { stop: () => void; jumpTo: (o: unknown) => void; resize: () => void } }).__RTW_MAP__
        m.resize()
        m.stop()
        m.jumpTo({ center, zoom: 15, pitch: 0, bearing: 0 })
      }, CENTER)
      await page.waitForTimeout(800)

      const canvas = page.locator('canvas.mapboxgl-canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('map canvas missing')
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      const surface = page.locator('.map-view__pick-dock-panel, .map-view__pick-popup').last()
      const opened = await surface.isVisible({ timeout: 20_000 }).catch(() => false)
      if (!opened) {
        // 이 뷰포트에서는 하네스가 pick 표면을 열지 못했다. 실기기 확인이 필요하다 —
        // 열리지 않았다는 사실 자체를 기록하고 넘어간다(계측기이지 게이트가 아니다).
        console.log(`[5A-cover] ${vp.label.padEnd(21)} pick 표면 미개방 — 미측정`)
        return
      }
      await page.waitForTimeout(400)

      const sBox = await surface.boundingBox()
      const mapArea = box.width * box.height
      const cover = sBox ? (sBox.width * sBox.height) / mapArea : 0
      console.log(
        `[5A-cover] ${vp.label.padEnd(21)} map ${Math.round(box.width)}x${Math.round(box.height)} ` +
          `surface ${sBox ? `${Math.round(sBox.width)}x${Math.round(sBox.height)}` : '-'} ` +
          `점유 ${(cover * 100).toFixed(1)}%`,
      )
      expect(true).toBe(true)
    })
  }
})
