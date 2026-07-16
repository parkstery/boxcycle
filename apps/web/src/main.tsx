import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'            // ← 디자인 토큰 단일 진실 — 가장 먼저
import './index.css'
import App from './App.tsx'
import './boxcycle-theme.css';   // 다크 테마 (토큰 별칭 레이어)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
