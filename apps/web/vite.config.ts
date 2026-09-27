import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveDevPort } from './devPort'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // 의존성 스캔 대상을 앱 진입점 하나로 못박는다.
  //
  // 기본값은 root 아래 **모든** HTML 을 훑는데, 그러면 `scripts/*/**.html`(rider-preview
  // 등 하네스)까지 앱 의존성 그래프로 끌려온다. 그 하네스들은 브라우저에서 직접 여는
  // 독립 문서이고 three 를 **importmap → unpkg CDN** 으로 받는다. Vite 스캐너는
  // importmap 을 모르므로 `three/addons/...` 를 node_modules 에서 찾다 실패하고,
  // 그 한 건 때문에 **스캔 전체가 중단되어 pre-bundling 이 통째로 skip** 된다
  // (dev 서버는 뜨지만 느려지고 CJS 의존성에서 엉뚱한 오류가 난다).
  optimizeDeps: { entries: ["index.html"] },
  // 같은 Wi-Fi의 폰·다른 PC에서 `http://<이 PC의 LAN IP>:5000` 으로 접속하려면
  // 모든 인터페이스(0.0.0.0)에 바인딩해야 한다. 터미널에 Network 주소가 함께 출력된다.
  //
  // RTW_DEV_PORT 로 포트를 덮어쓸 수 있다 — 다른 worktree 에서 dev 서버가 이미 5000 을
  // 잡고 있을 때 e2e 를 나란히 돌리기 위한 것. 지정하지 않으면 기존과 동일한 5000.
  // mode=emulator 는 Functions Emulator(5001)와 충돌하지 않도록 5002 를 쓴다.
  server: {
    host: true,
    // 포트 값은 ./devPort 가 소유한다 — playwright.config.ts 와 같은 표를 본다.
    port: resolveDevPort(mode === "emulator"),
    strictPort: false,
  },
}))
