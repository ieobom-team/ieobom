import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom 은 matchMedia 를 구현하지 않는다. 기본값은 데스크톱(미매치)으로 두고,
// 모바일 반응형을 보는 테스트는 각자 vi.stubGlobal('matchMedia', ...)로 덮어쓴다. (#114)
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// 테스트끼리 DOM 과 진입 선택값이 새지 않게 한다.
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
