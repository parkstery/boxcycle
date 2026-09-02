import { expect, type Page } from '@playwright/test'

/**
 * 익명 게스트 uid — Firestore fixture 소유자 식별용.
 * Firebase Web SDK 는 기본적으로 IndexedDB(`firebaseLocalStorageDb`)에 저장하므로
 * localStorage 만 보면 timeout 이다. localStorage 는 fallback 으로만 훑는다.
 */
export async function readGuestUid(page: Page): Promise<string> {
  let uid: string | null = null
  await expect
    .poll(
      async () => {
        uid = await page.evaluate(
          () =>
            new Promise<string | null>((resolve) => {
              const fromLocal = (() => {
                for (let i = 0; i < localStorage.length; i += 1) {
                  const key = localStorage.key(i)
                  if (!key || !key.startsWith('firebase:authUser:')) continue
                  try {
                    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as {
                      uid?: string
                    }
                    if (parsed?.uid) return parsed.uid
                  } catch {
                    /* noop */
                  }
                }
                return null
              })()
              if (fromLocal) {
                resolve(fromLocal)
                return
              }
              let settled = false
              const done = (v: string | null) => {
                if (!settled) {
                  settled = true
                  resolve(v)
                }
              }
              try {
                const req = indexedDB.open('firebaseLocalStorageDb')
                req.onerror = () => done(null)
                req.onsuccess = () => {
                  try {
                    const db = req.result
                    const store = db
                      .transaction('firebaseLocalStorage', 'readonly')
                      .objectStore('firebaseLocalStorage')
                    const all = store.getAll()
                    all.onsuccess = () => {
                      const rows = all.result as {
                        fbase_key?: string
                        value?: { uid?: string }
                      }[]
                      const row = rows.find(
                        (r) =>
                          typeof r.fbase_key === 'string' &&
                          r.fbase_key.startsWith('firebase:authUser:'),
                      )
                      done(row?.value?.uid ?? null)
                    }
                    all.onerror = () => done(null)
                  } catch {
                    done(null)
                  }
                }
              } catch {
                done(null)
              }
            }),
        )
        return uid
      },
      { timeout: 30_000, message: '게스트 uid 를 찾지 못했다 — 익명 인증이 끝나지 않았다' },
    )
    .not.toBeNull()
  return uid as string
}
