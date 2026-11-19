import { test, expect } from './open-meteo-stub'

test('Firebase production HTTP and WebSocket channels are rejected by browser CSP', async ({ page, context }) => {
  const escaped: string[] = []
  // If CSP regresses, abort instead of sending even a probe to a real service.
  await context.route('**/__e2e_isolation_probe__', async route => {
    escaped.push(route.request().url())
    await route.abort()
  })
  const response = await page.goto('/')
  expect(response?.headers()['content-security-policy']).toContain('connect-src')
  const blocked = await page.evaluate(async () => {
    const violations: string[] = []
    document.addEventListener('securitypolicyviolation', event => violations.push(event.blockedURI))
    const hosts = [
      'firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com',
      'boxcycle-dc2df-default-rtdb.firebaseio.com',
      'boxcycle-dc2df-eu-rtdb.europe-west1.firebasedatabase.app',
      'asia-northeast3-boxcycle-dc2df.cloudfunctions.net', 'example.a.run.app',
      'firebasestorage.googleapis.com',
    ]
    const failed = await Promise.all(hosts.map(host => fetch(`https://${host}/__e2e_isolation_probe__`)
      .then(() => false, () => true)))
    const websocketBlocked = await new Promise<boolean>(resolve => {
      try {
        const socket = new WebSocket('wss://boxcycle-dc2df-default-rtdb.firebaseio.com/__e2e_isolation_probe__')
        socket.onerror = () => { socket.close(); resolve(true) }
        socket.onopen = () => { socket.close(); resolve(false) }
      } catch { resolve(true) }
    })
    const localOk = (await fetch('/@vite/client')).ok
    return { failed, websocketBlocked, localOk, violations }
  })
  expect(blocked.failed).toEqual(Array(8).fill(true))
  expect(blocked.websocketBlocked).toBe(true)
  expect(blocked.localOk).toBe(true)
  expect(blocked.violations.length).toBeGreaterThanOrEqual(8)
  expect(escaped).toEqual([])
})
