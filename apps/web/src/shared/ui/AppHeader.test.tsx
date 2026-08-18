import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from './AppHeader'
import { createQueryClient } from '../api/queryClient'
import { SessionProvider } from '../../features/session/SessionProvider'
import { loadSession, saveSession } from '../../features/session/sessionStorage'
import { seedStaffCache, TEST_STAFF } from '../../features/session/staffFixture'

/**
 * AppHeader 1행 우측(세션 영역)의 반응형 축약. (#114)
 *
 * `sm`(640px) 미만에서는 이름/역할 칩 + 알림함만 1행에 남고, "본인 바꾸기"·"PIN 설정"은
 * 칩을 탭해야 열리는 드롭다운 안으로 옮겨간다. `sm` 이상에서는 기존(#88) 펼침 레이아웃 그대로다.
 */

const 김하늘 = TEST_STAFF[0]

/** `window.matchMedia`를 고정 응답으로 모킹한다. jsdom 리사이즈 이벤트에 기대지 않기 위함. */
function mockMatchMedia(matchesMobileQuery: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 639px)' ? matchesMobileQuery : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

function renderHeader() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SessionProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  seedStaffCache()
  saveSession({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sm 이상(데스크톱/태블릿)', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  it('이름/역할 칩·본인 바꾸기·PIN 설정·알림함이 모두 펼쳐진 채로 보인다 (#88 동작 유지)', () => {
    renderHeader()

    expect(screen.getByText(김하늘.name)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '본인 바꾸기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /PIN 설정/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /알림함/ })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('본인 바꾸기를 누르면 바로 세션이 초기화된다', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: '본인 바꾸기' }))

    expect(loadSession()).toBeNull()
  })
})

describe('sm 미만(모바일)', () => {
  beforeEach(() => {
    mockMatchMedia(true)
  })

  it('1행에는 이름/역할 칩과 알림함만 보인다', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: /알림함/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '본인 바꾸기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /PIN 설정/ })).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: new RegExp(김하늘.name) })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('칩을 탭하면 본인 바꾸기·PIN 설정이 담긴 드롭다운이 열린다', async () => {
    const user = userEvent.setup()
    renderHeader()

    const trigger = screen.getByRole('button', { name: new RegExp(김하늘.name) })
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: '본인 바꾸기' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /PIN 설정/ })).toBeInTheDocument()
  })

  it('키보드로 트리거에 포커스 후 Enter로 열 수 있다', async () => {
    const user = userEvent.setup()
    renderHeader()

    const trigger = screen.getByRole('button', { name: new RegExp(김하늘.name) })
    trigger.focus()
    expect(trigger).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('드롭다운 안에서 본인 바꾸기를 누르면 기존과 동일하게 세션이 초기화된다', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: new RegExp(김하늘.name) }))
    await user.click(screen.getByRole('menuitem', { name: '본인 바꾸기' }))

    expect(loadSession()).toBeNull()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('드롭다운 안에서 PIN 설정을 누르면 기존과 동일하게 PIN 모달이 열린다', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: new RegExp(김하늘.name) }))
    await user.click(screen.getByRole('menuitem', { name: /PIN 설정/ }))

    expect(await screen.findByText('PIN 번호 신규 등록')).toBeInTheDocument()
  })

  it('Esc를 누르면 드롭다운이 닫힌다', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: new RegExp(김하늘.name) }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('바깥 영역을 클릭하면 드롭다운이 닫힌다', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: new RegExp(김하늘.name) }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('알림함은 계속 노출된다', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: /알림함/ })).toBeInTheDocument()
  })
})
