import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SessionProvider } from '../features/session/SessionProvider'
import { loadSession, saveSession } from '../features/session/sessionStorage'
import { STAFF_DIRECTORY } from '../features/session/staffDirectory'
import { AppRoutes } from './AppRoutes'

const 김하늘 = STAFF_DIRECTORY[0]

function renderApp(initialPath = '/') {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
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

  it('현장 근무자를 고르면 현장 홈으로 간다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /현장 근무자/ }))
    await user.click(screen.getByRole('button', { name: /김하늘/ }))

    expect(screen.getByRole('heading', { name: '현장 홈' })).toBeInTheDocument()
  })

  it('관리자·센터장을 고르면 관리자 홈으로 간다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /관리자·센터장/ }))
    await user.click(screen.getByRole('button', { name: /김하늘/ }))

    expect(screen.getByRole('heading', { name: '관리자 홈' })).toBeInTheDocument()
  })

  it('고른 값은 이후 화면에서 입력자로 쓸 수 있게 남는다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /현장 근무자/ }))
    await user.click(screen.getByRole('button', { name: /김하늘/ }))

    expect(loadSession()).toEqual({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
    expect(screen.getByText(김하늘.code)).toBeInTheDocument()
  })
})

describe('진입 전 화면 접근', () => {
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
    saveSession({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
    renderApp('/field')

    await user.click(screen.getByRole('button', { name: '본인 바꾸기' }))

    expect(screen.getByRole('heading', { name: /어떤 화면으로 들어가시나요/ })).toBeInTheDocument()
    expect(loadSession()).toBeNull()
  })
})
