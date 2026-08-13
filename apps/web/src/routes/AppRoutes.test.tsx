import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../shared/api/queryClient'
import { SessionProvider } from '../features/session/SessionProvider'
import { loadSession, saveSession } from '../features/session/sessionStorage'
import { seedStaffCache, TEST_STAFF } from '../features/session/staffFixture'
import { AppRoutes } from './AppRoutes'

const 김하늘 = TEST_STAFF[0]

/** 명단을 받아 오지 못하는 상황을 만드는 스위치. */
let 연결_끊김: boolean

beforeEach(() => {
  연결_끊김 = false

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      if (input.includes('/api/staff')) {
        if (연결_끊김) {
          return Promise.reject(new TypeError('Failed to fetch'))
        }
        return Promise.resolve(
          new Response(JSON.stringify({ staff: TEST_STAFF }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      // 이 파일은 진입 흐름만 본다. 다른 화면의 조회는 연결 실패로 두고 각자의 테스트에 맡긴다.
      return Promise.reject(new TypeError('Failed to fetch'))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderApp(initialPath = '/') {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SessionProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

describe('진입 역할·본인 식별 선택', () => {
  it('진입 역할은 2종만 고를 수 있다', () => {
    renderApp()

    expect(screen.getByRole('button', { name: /현장 근무자/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /관리자·센터장/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('비밀번호를 요구하지 않는다', () => {
    const { container } = renderApp()

    expect(container.querySelector('input')).toBeNull()
  })

  it('본인 선택 목록은 서버 명단에서 온다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /현장 근무자/ }))

    // 명단이 프론트 상수였다면 이 목록은 호출 없이도 그려졌을 것이다. (#33)
    expect(await screen.findByRole('button', { name: /김하늘/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /이도윤/ })).toBeInTheDocument()
  })

  it('현장 근무자를 고르면 현장 홈으로 간다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /현장 근무자/ }))
    await user.click(await screen.findByRole('button', { name: /김하늘/ }))

    expect(screen.getByRole('heading', { name: '현장 홈' })).toBeInTheDocument()
  })

  it('관리자·센터장을 고르면 관리자 홈으로 간다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /관리자·센터장/ }))
    await user.click(await screen.findByRole('button', { name: /김하늘/ }))

    expect(screen.getByRole('heading', { name: '관리자 홈' })).toBeInTheDocument()
  })

  it('고른 값은 이후 화면에서 입력자로 쓸 수 있게 남는다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /현장 근무자/ }))
    await user.click(await screen.findByRole('button', { name: /김하늘/ }))

    expect(loadSession()).toEqual({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
    expect(screen.getByText(김하늘.code)).toBeInTheDocument()
  })
})

describe('명단을 받아 오지 못했을 때', () => {
  it('마지막으로 받아 둔 명단으로 고를 수 있다', async () => {
    // 돌봄 중인 근무자에게 연결이 돌아올 때까지 기다리라고 하지 않는다.
    // (Manyfast F-YJJJUX exceptions)
    seedStaffCache()
    연결_끊김 = true
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /현장 근무자/ }))
    await user.click(await screen.findByRole('button', { name: /김하늘/ }))

    expect(screen.getByRole('heading', { name: '현장 홈' })).toBeInTheDocument()
  })

  it('받아 둔 명단도 없으면 다시 불러오기를 안내한다', async () => {
    연결_끊김 = true
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /현장 근무자/ }))

    expect(await screen.findByText(/직원 명단을 불러오지 못했습니다/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /명단 다시 불러오기/ })).toBeInTheDocument()
  })

  it('다시 불러오기를 누르면 연결이 돌아온 뒤 명단이 나온다', async () => {
    연결_끊김 = true
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /현장 근무자/ }))
    await screen.findByText(/직원 명단을 불러오지 못했습니다/)

    연결_끊김 = false
    await user.click(screen.getByRole('button', { name: /명단 다시 불러오기/ }))

    expect(await screen.findByRole('button', { name: /김하늘/ })).toBeInTheDocument()
  })
})

describe('진입 전 화면 접근', () => {
  beforeEach(() => {
    // 저장된 선택값은 받아 둔 명단에서 이름을 다시 찾아 되살아난다.
    seedStaffCache()
  })

  it('고르기 전에는 현장 홈을 열 수 없다', () => {
    renderApp('/field')

    expect(screen.getByRole('heading', { name: /어떤 화면으로 들어가시나요/ })).toBeInTheDocument()
  })

  it('이미 고른 상태로 다시 들어오면 자기 홈으로 간다', () => {
    saveSession({ entryRole: 'MANAGER', staff: 김하늘 })

    renderApp('/')

    expect(screen.getByRole('heading', { name: '관리자 홈' })).toBeInTheDocument()
  })

  it('다른 역할의 홈을 주소로 열면 자기 홈으로 되돌린다', () => {
    saveSession({ entryRole: 'FIELD_WORKER', staff: 김하늘 })

    renderApp('/admin')

    expect(screen.getByRole('heading', { name: '현장 홈' })).toBeInTheDocument()
  })
})

describe('본인 바꾸기', () => {
  it('선택을 지우고 진입 선택 화면으로 되돌아간다', async () => {
    const user = userEvent.setup()
    seedStaffCache()
    saveSession({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
    renderApp('/field')

    await user.click(screen.getByRole('button', { name: '본인 바꾸기' }))

    expect(screen.getByRole('heading', { name: /어떤 화면으로 들어가시나요/ })).toBeInTheDocument()
    expect(loadSession()).toBeNull()
  })
})
