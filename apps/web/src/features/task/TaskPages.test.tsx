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
import type { HandoverCard, JobRole } from '../handover-card/handoverCardApi'
import type { TaskResponse } from './taskApi'

const 김하늘 = TEST_STAFF[0]

function 카드(patch: Partial<HandoverCard> = {}): HandoverCard {
  return {
    id: 31,
    handoverId: 12,
    careRecipientId: 1,
    careRecipientName: '김말순',
    observedAt: '2026-08-11T12:40:00',
    statusChange: '점심 식사량 저하',
    actionTaken: null,
    nextAction: '저녁 식사량 확인',
    evidenceText: '점심을 거의 안 드셨어요',
    safetyRelated: false,
    safetyFlagSource: null,
    reviewStatus: 'REVIEWED',
    suggestedJobRole: 'NURSE_AIDE',
    suggestedDueTime: '17:00',
    exportAllowed: true,
    exportBlockedReason: null,
    createdAt: '2026-08-11T13:11:02.401',
    hasAudio: false,
    suggestedActions: [],
    ...patch,
  }
}

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
      if (input.includes('/api/handover-cards/31/tasks')) {
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
        const assigneeName =
          typeof body.assigneeName === 'string' && body.assigneeName.trim() !== ''
            ? body.assigneeName.trim()
            : null
        return Promise.resolve(
          new Response(
            JSON.stringify(
              업무({
                content: String(body.content ?? '저녁 식사량 확인'),
                assigneeName,
                assigneeJobRole: (body.assigneeJobRole as JobRole) ?? 'NURSE_AIDE',
                assigneeJobRoleLabel: '간호조무사',
                dueTime: String(body.dueTime ?? '17:00'),
              }),
            ),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }
      if (input.includes('/api/handover-cards')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              date: '2026-08-11',
              recipients: [
                {
                  careRecipientId: 1,
                  careRecipientName: '김말순',
                  cards: [카드()],
                },
              ],
              unresolved: [],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }
      if (input.includes('/api/staff')) {
        return Promise.resolve(
          new Response(JSON.stringify({ staff: TEST_STAFF }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
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

describe('후속 업무 배정 (n26 → n27 · n28 · n29 · n30)', () => {
  it('카드의 제안값으로 채워져 열리며 제안된 직종의 소속 직원만 드롭다운에 노출된다', async () => {
    renderApp('/handover-cards/31/tasks/new')

    expect(await screen.findByLabelText('다음 행동')).toHaveValue('저녁 식사량 확인')
    expect(screen.getByLabelText('기한')).toHaveValue('17:00')

    const select = screen.getByLabelText('담당자 (선택)') as HTMLSelectElement
    expect(select).toHaveValue('')
    expect(screen.getByRole('option', { name: '직종만 배정 (특정인 미지정)' })).toBeInTheDocument()
    // 제안 직종이 간호조무사이므로 간호조무사 직원만 노출
    expect(screen.getByRole('option', { name: '최민재 (ST-004)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '정유진 (ST-005)' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '김하늘 (ST-001)' })).not.toBeInTheDocument()
  })

  it('직종을 바꾸면 해당 직종의 직원 목록으로 바뀌고 직원을 골라 배정할 수 있다', async () => {
    const user = userEvent.setup()
    renderApp('/handover-cards/31/tasks/new')

    // 요양보호사 버튼 클릭
    await user.click(await screen.findByRole('button', { name: '요양보호사' }))

    const select = screen.getByLabelText('담당자 (선택)')
    // 요양보호사 직원(김하늘) 선택
    expect(screen.getByRole('option', { name: '김하늘 (ST-001)' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '최민재 (ST-004)' })).not.toBeInTheDocument()

    await user.selectOptions(select, '김하늘')

    await user.click(screen.getByRole('button', { name: '업무로 배정하기' }))

    const notice = await screen.findByRole('status')
    expect(within(notice).getByRole('heading', { name: '업무를 배정했습니다' })).toBeInTheDocument()
    expect(within(notice).getByText(/담당 김하늘 \(간호조무사\)/)).toBeInTheDocument()
  })

  it('담당자를 특정하지 않고 직종으로만 배정할 수 있다', async () => {
    const user = userEvent.setup()
    renderApp('/handover-cards/31/tasks/new')

    const button = await screen.findByRole('button', { name: '업무로 배정하기' })
    await user.click(button)

    const notice = await screen.findByRole('status')
    expect(within(notice).getByRole('heading', { name: '업무를 배정했습니다' })).toBeInTheDocument()
    expect(within(notice).getByText(/담당 간호조무사 · 17:00까지/)).toBeInTheDocument()
  })
})
