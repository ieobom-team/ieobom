import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 개발 서버가 `/api` 를 백엔드로 넘긴다.
  //
  // 이렇게 두면 브라우저에서는 프론트와 API 가 같은 출처라 CORS 가 아예 생기지 않는다.
  // 백엔드에는 CORS 설정이 없고, 넣더라도 개발용으로만 열어 둔 설정이 배포까지 따라가기 쉽다.
  // `VITE_API_BASE_URL` 없이 `npm run dev` 만으로 붙는다는 것도 같이 얻는다.
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
