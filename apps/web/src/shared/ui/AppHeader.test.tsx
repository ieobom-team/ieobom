import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
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

/**
 * 2행 뒤로가기 — 실제로 들어온 이전 화면이 있으면 거기로, 없으면 고정 backTo로 폴백한다. (#134)
 *
 * "관리자 현황 → 인계 카드 상세 → 뒤로가기"처럼 화면마다 다른 곳에서 들어오는 공유 화면에서,
 * 뒤로가기가 항상 같은 고정 목록으로만 가던 문제를 고친다.
 */
describe('2행 뒤로가기 (#134 — 히스토리 기반 + 고정 backTo 폴백)', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  function renderInRoutes(initialEntries: string[]) {
    return render(
      <QueryClientProvider client={createQueryClient()}>
        <SessionProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route
                path="/b"
                element={
                  <>
                    <AppHeader title="B 화면" backTo="/fallback" backLabel="뒤로" showSession={false} />
                    <Link to="/a">A로 이동</Link>
                  </>
                }
              />
              <Route
                path="/a"
                element={
                  <>
                    <AppHeader title="A 화면" backTo="/fallback" backLabel="뒤로" showSession={false} />
                    <p>A 화면 본문</p>
                  </>
                }
              />
              <Route path="/fallback" element={<p>폴백 화면 본문</p>} />
            </Routes>
          </MemoryRouter>
        </SessionProvider>
      </QueryClientProvider>,
    )
  }

  it('앱 안에서 실제로 이동해 들어온 경우, 뒤로가기는 고정 backTo가 아니라 실제 이전 화면으로 간다', async () => {
    const user = userEvent.setup()
    renderInRoutes(['/b'])

    await user.click(screen.getByRole('link', { name: 'A로 이동' }))
    expect(await screen.findByText('A 화면 본문')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '뒤로' }))

    // 고정 backTo("폴백 화면")가 아니라 실제로 있었던 B 화면으로 돌아간다.
    expect(await screen.findByRole('link', { name: 'A로 이동' })).toBeInTheDocument()
    expect(screen.queryByText('폴백 화면 본문')).not.toBeInTheDocument()
  })

  it('알림함·직접 URL 등 앱 안에서 이동해 들어온 이력이 없으면, 고정 backTo로 폴백한다', async () => {
    const user = userEvent.setup()
    renderInRoutes(['/a'])

    await user.click(screen.getByRole('button', { name: '뒤로' }))

    expect(await screen.findByText('폴백 화면 본문')).toBeInTheDocument()
  })
})
