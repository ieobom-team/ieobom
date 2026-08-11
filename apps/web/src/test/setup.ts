import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 테스트끼리 DOM 과 진입 선택값이 새지 않게 한다.
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
