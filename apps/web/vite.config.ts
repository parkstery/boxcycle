import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 같은 Wi-Fi의 폰·다른 PC에서 `http://<이 PC의 LAN IP>:5000` 으로 접속하려면
  // 모든 인터페이스(0.0.0.0)에 바인딩해야 한다. 터미널에 Network 주소가 함께 출력된다.
  server: {
    host: true,
    port: 5000,
    strictPort: false,
  },
})
