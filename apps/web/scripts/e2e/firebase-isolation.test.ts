import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertE2EEmulators, isolatedWebEnvironment } from '../../e2eIsolation.ts'

const local = {
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
}

test('missing, remote, or mismatched emulator endpoints fail before any SDK initialization', () => {
  for (const key of Object.keys(local)) {
    for (const value of [undefined, '', 'example.com:8080', '127.0.0.1:12345', 'https://127.0.0.1:8080']) {
      assert.throws(() => assertE2EEmulators({ ...local, [key]: value }), /e2e isolation/)
    }
  }
  assert.throws(() => assertE2EEmulators({ ...local, FIREBASE_FUNCTIONS_EMULATOR_HOST: 'example.com:5001' }), /e2e isolation/)
  assert.doesNotThrow(() => assertE2EEmulators(local))
  assert.doesNotThrow(() => assertE2EEmulators({ ...local, FIRESTORE_EMULATOR_HOST: 'localhost:8080' }))
})

test('browser overrides cannot inherit real credentials, remote Functions or disabled emulators', () => {
  const result = isolatedWebEnvironment({ ...local, GCLOUD_PROJECT: 'demo-isolated',
    VITE_FIREBASE_API_KEY: 'real-key', VITE_USE_EMULATOR: '0',
    VITE_FUNCTIONS_EMULATOR_HOST: 'remote.example:443',
    VITE_FIREBASE_DATABASE_URL: 'https://production.firebaseio.com',
  })
  assert.equal(result.VITE_USE_EMULATOR, '1')
  assert.equal(result.VITE_FIREBASE_API_KEY, 'fake-api-key-for-emulator')
  assert.equal(result.VITE_FUNCTIONS_EMULATOR_HOST, '127.0.0.1:5001')
  assert.equal(result.VITE_FIREBASE_PROJECT_ID, 'demo-isolated')
  assert.equal(result.VITE_FIREBASE_DATABASE_URL, 'http://127.0.0.1:9000?ns=demo-isolated-default-rtdb')
})
