import { createConnection } from 'node:net'
import type { Plugin } from 'vite'

type Environment = Record<string, string | undefined>

// The SDK connections in firebase/app.ts use these fixed loopback ports.
const EMULATORS = [
  ['FIREBASE_AUTH_EMULATOR_HOST', 9099],
  ['FIRESTORE_EMULATOR_HOST', 8080],
  ['FIREBASE_DATABASE_EMULATOR_HOST', 9000],
] as const

function assertLocalEndpoint(value: string | undefined, port: number, name: string): void {
  if (value !== `127.0.0.1:${port}` && value !== `localhost:${port}`) {
    throw new Error(
      `[e2e isolation] ${name} must be 127.0.0.1:${port}. ` +
      '운영 연결을 막기 위해 시험을 중단합니다. npm run test:e2e 또는 Firebase emulators:exec로 실행하세요.',
    )
  }
}

/** Runs while loading Playwright config, before specs can initialize an Admin SDK. */
export function assertE2EEmulators(env: Environment): void {
  for (const [key, port] of EMULATORS) assertLocalEndpoint(env[key], port, key)
  if (env.FIREBASE_FUNCTIONS_EMULATOR_HOST) {
    assertLocalEndpoint(env.FIREBASE_FUNCTIONS_EMULATOR_HOST, 5001, 'FIREBASE_FUNCTIONS_EMULATOR_HOST')
  }
}

/** Explicit overrides win over inherited shell VITE_* and local .env files. */
export function isolatedWebEnvironment(env: Environment): Record<string, string> {
  assertE2EEmulators(env)
  const projectId = env.GCLOUD_PROJECT || 'boxcycle-dc2df'
  if (!/^[a-z][a-z0-9-]+$/.test(projectId)) throw new Error('[e2e isolation] Invalid emulator project ID')
  return {
    RTW_E2E_ISOLATED: '1',
    VITE_USE_EMULATOR: '1',
    VITE_FIREBASE_API_KEY: 'fake-api-key-for-emulator',
    VITE_FIREBASE_AUTH_DOMAIN: 'localhost',
    VITE_FIREBASE_PROJECT_ID: projectId,
    VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef',
    VITE_FIREBASE_STORAGE_BUCKET: `${projectId}.appspot.com`,
    VITE_FIREBASE_DATABASE_URL: `http://127.0.0.1:9000?ns=${projectId}-default-rtdb`,
    VITE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001',
    VITE_FUNCTIONS_REGION: 'asia-northeast3',
  }
}

// No Google/Firebase/Cloud Run origins. Applies to fetch, SDK channels, workers,
// RTDB WebSockets, and frames that import app modules without using our fixture.
export const E2E_CONNECT_POLICY = "connect-src 'self' http://127.0.0.1:* http://localhost:* " +
  'ws://127.0.0.1:* ws://localhost:* blob: ' +
  'https://*.mapbox.com https://*.open-meteo.com'

export function e2eIsolationPlugin(): Plugin {
  return {
    name: 'e2e-firebase-isolation',
    configResolved(config) {
      if (config.env.VITE_USE_EMULATOR !== '1' || config.env.VITE_FUNCTIONS_EMULATOR_HOST !== '127.0.0.1:5001') {
        throw new Error('[e2e isolation] Vite must use local Firebase emulators')
      }
    },
    configureServer(server) {
      server.middlewares.use((_request, response, next) => {
        response.setHeader('Content-Security-Policy', E2E_CONNECT_POLICY)
        next()
      })
    },
  }
}

/** Verify availability before launching any browser. No HTTP writes or remote probes. */
export default async function verifyEmulators(): Promise<void> {
  assertE2EEmulators(process.env)
  const ports: number[] = EMULATORS.map(([, port]) => port)
  if (process.env.RTW_E2E_WITH_FUNCTIONS === '1' || process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST) ports.push(5001)
  await Promise.all(ports.map((port) => new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.setTimeout(2000)
    const fail = () => {
      socket.destroy()
      reject(new Error(`[e2e isolation] Emulator unavailable at 127.0.0.1:${port}; 시험 중단 (운영 폴백 없음)`))
    }
    socket.once('connect', () => { socket.destroy(); resolve() })
    socket.once('error', fail)
    socket.once('timeout', fail)
  })))
}
