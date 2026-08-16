import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 같은 Wi-Fi의 폰·다른 PC에서 `http://<이 PC의 LAN IP>:5000` 으로 접속하려면
  // 모든 인터페이스(0.0.0.0)에 바인딩해야 한다. 터미널에 Network 주소가 함께 출력된다.
  //
  // RTW_DEV_PORT 로 포트를 덮어쓸 수 있다 — 다른 worktree 에서 dev 서버가 이미 5000 을
  // 잡고 있을 때 e2e 를 나란히 돌리기 위한 것. 지정하지 않으면 기존과 동일한 5000.
  server: {
    host: true,
    port: Number(process.env.RTW_DEV_PORT ?? 5000),
    strictPort: false,
  },
})
