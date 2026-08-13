import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../routes/AppRoutes'
import { createQueryClient } from '../../shared/api/queryClient'
import { SessionProvider } from '../session/SessionProvider'
import { saveSession } from '../session/sessionStorage'
import { seedStaffCache, TEST_STAFF } from '../session/staffFixture'
import type { TaskResponse } from './taskApi'

const 김하늘 = TEST_STAFF[0]

function 업무(patch: Partial<TaskResponse> = {}): TaskResponse {
  return {
    id: 4,
    handoverCardId: 31,
    careRecipientId: 1,
    careRecipientName: '김말순',
    content: '저녁 식사량 확인',
    assigneeJobRole: 'NURSE_AIDE',
    assigneeJobRoleLabel: '간호조무사',
    assigneeName: '박간호',
    dueTime: '17:30',
    status: 'PENDING',
    statusLabel: '미처리',
    delegated: false,
    completedAt: null,
    completedByName: null,
    createdAt: '2026-08-12T14:02:11.402',
    ...patch,
  }
}

type Outcome = { status: number; body: unknown }

let 목록_응답: Outcome
let 상세_응답: Outcome
let 완료_응답: Outcome

beforeEach(() => {
  목록_응답 = { status: 200, body: { date: '2026-08-12', tasks: [업무()] } }
  상세_응답 = { status: 200, body: 업무() }
  완료_응답 = {
    status: 200,
    body: {
      alreadyCompleted: false,
      notice: null,
      task: 업무({ status: 'DONE', statusLabel: '완료', completedByName: '이복지', delegated: true }),
    },
  }

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      if (input.includes('/complete')) {
        return Promise.resolve(
          new Response(JSON.stringify(완료_응답.body), {
            status: 완료_응답.status,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (/\/api\/tasks\/\d+$/.test(input)) {
        return Promise.resolve(
          new Response(JSON.stringify(상세_응답.body), {
            status: 상세_응답.status,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (input.includes('/api/tasks')) {
        return Promise.resolve(
          new Response(JSON.stringify(목록_응답.body), {
            status: 목록_응답.status,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      throw new Error(`테스트가 예상하지 못한 호출입니다: ${input} ${String(init?.method)}`)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderApp(initialPath = '/tasks') {
  seedStaffCache()
  saveSession({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
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

describe('업무 목록 (n31 · n32)', () => {
  it('현장 홈에서 들어올 수 있다', async () => {
    const user = userEvent.setup()
    renderApp('/field')

    await user.click(screen.getByRole('button', { name: /내 할 일 확인/ }))

    expect(await screen.findByRole('heading', { name: '오늘의 업무' })).toBeInTheDocument()
  })

  it('담당·기한·상태를 함께 보여 준다', async () => {
    renderApp()

    const item = await screen.findByRole('button', { name: /저녁 식사량 확인/ })
    expect(item).toHaveTextContent('박간호')
    expect(item).toHaveTextContent('간호조무사')
    expect(item).toHaveTextContent('17:30까지')
    expect(item).toHaveTextContent('미처리')
  })

  it('당일 업무가 없으면 비어 있다고 알린다', async () => {
    목록_응답 = { status: 200, body: { date: '2026-08-12', tasks: [] } }
    renderApp()

    expect(await screen.findByText('오늘 등록된 업무가 없습니다.')).toBeInTheDocument()
  })

  it('업무를 고르면 상세로 간다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: /저녁 식사량 확인/ }))

    expect(await screen.findByRole('heading', { name: '업무 상세' })).toBeInTheDocument()
  })
})

describe('업무 상세와 완료 처리 (n35 · n59 · n60 · n33)', () => {
  it('수행 확인에서 아니오를 고르면 아무것도 바꾸지 않고 목록으로 돌아간다', async () => {
    const user = userEvent.setup()
    renderApp('/tasks/4')

    await user.click(await screen.findByRole('button', { name: '완료 처리' }))
    await user.click(screen.getByRole('button', { name: '아니오' }))

    expect(await screen.findByRole('heading', { name: '오늘의 업무' })).toBeInTheDocument()
  })

  it('수행 확인 후 확인자 이름으로 완료 처리하면 대리 완료 여부와 확인자를 보여 준다', async () => {
    const user = userEvent.setup()
    renderApp('/tasks/4')

    await user.click(await screen.findByRole('button', { name: '완료 처리' }))
    await user.click(screen.getByRole('button', { name: '예, 확인했습니다' }))

    const input = screen.getByLabelText('확인자 이름')
    expect(input).toHaveValue('김하늘')
    await user.clear(input)
    await user.type(input, '이복지')
    await user.click(screen.getByRole('button', { name: '완료 처리' }))

    const result = await screen.findByRole('status')
    expect(within(result).getByRole('heading', { name: '완료 처리했습니다' })).toBeInTheDocument()
    expect(within(result).getByText(/이복지 님이 대리 완료 처리/)).toBeInTheDocument()
  })

  it('이미 완료된 업무를 다시 완료 처리하면 중복 완료를 안내한다', async () => {
    완료_응답 = {
      status: 200,
      body: {
        alreadyCompleted: true,
        notice: '이미 완료 처리된 업무입니다. 완료 확인자와 시각을 확인해 주세요.',
        task: 업무({ status: 'DONE', statusLabel: '완료', completedByName: '이복지', delegated: true }),
      },
    }
    const user = userEvent.setup()
    renderApp('/tasks/4')

    await user.click(await screen.findByRole('button', { name: '완료 처리' }))
    await user.click(screen.getByRole('button', { name: '예, 확인했습니다' }))
    await user.click(screen.getByRole('button', { name: '완료 처리' }))

    expect(
      await screen.findByRole('heading', { name: '이미 완료 처리된 업무입니다' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/완료 확인자와 시각을 확인해 주세요/)).toBeInTheDocument()
  })
})
