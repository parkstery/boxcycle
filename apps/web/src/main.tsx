import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './boxcycle-theme.css';   // 다크 테마
import './panel-light.css';      // ← 맨 마지막: 패널·메뉴 라이트(흰 배경) 오버라이드

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
