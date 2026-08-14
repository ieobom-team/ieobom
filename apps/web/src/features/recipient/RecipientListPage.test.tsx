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
import type { CareRecipient } from './recipientApi'

/**
 * 유저플로우 "AI 인계 도구 내비게이션 맵" n49~n55 — 어르신 명단 관리.
 *
 * 서버가 명단의 진실이므로, 등록·수정·종료 뒤에 화면이 목록을 **다시 받아 오는지**까지 본다.
 */

const 김하늘 = TEST_STAFF[0]

function 어르신(patch: Partial<CareRecipient> = {}): CareRecipient {
  return { id: 1, name: '김말순', code: 'IB-001', dischargedAt: null, ...patch }
}

let 명단: CareRecipient[]
let 등록_응답: { status: number; body: unknown }
let 마지막_등록_요청: unknown

beforeEach(() => {
  명단 = [어르신()]
  등록_응답 = { status: 201, body: 어르신({ id: 2, name: '홍길동', code: 'IB-021' }) }
  마지막_등록_요청 = null

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'

      if (method === 'POST' && input.includes('/discharge')) {
        const id = Number(/care-recipients\/(\d+)\/discharge/.exec(input)?.[1])
        const found = 명단.find((recipient) => recipient.id === id)
        if (found !== undefined) {
          found.dischargedAt = '2026-08-13T10:00:00'
        }
        return json(200, found)
      }

      if (method === 'POST' && input.includes('/api/care-recipients')) {
        마지막_등록_요청 = JSON.parse(String(init?.body))
        if (등록_응답.status === 201) {
          명단 = [...명단, 등록_응답.body as CareRecipient]
        }
        return json(등록_응답.status, 등록_응답.body)
      }

      if (method === 'PATCH' && input.includes('/api/care-recipients')) {
        const id = Number(/care-recipients\/(\d+)/.exec(input)?.[1])
        const found = 명단.find((recipient) => recipient.id === id)
        if (found !== undefined) {
          found.name = (JSON.parse(String(init?.body)) as { name: string }).name
        }
        return json(200, found)
      }

      if (input.includes('/api/care-recipients')) {
        const 전체 = input.includes('includeDischarged=true')
        return json(200, {
          careRecipients: 전체
            ? 명단
            : 명단.filter((recipient) => recipient.dischargedAt === null),
        })
      }

      throw new Error(`테스트가 예상하지 못한 호출입니다: ${input} ${method}`)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function json(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function renderApp(initialPath = '/admin/care-recipients') {
  seedStaffCache()
  saveSession({ entryRole: 'MANAGER', staff: 김하늘 })
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

describe('어르신 명단 화면 (n49 · n50)', () => {
  it('관리자 홈에서 들어올 수 있다 (n42 → n58 → n49)', async () => {
    const user = userEvent.setup()
    renderApp('/admin')

    await user.click(screen.getByRole('link', { name: '어르신 명단' }))

    expect(await screen.findByRole('heading', { name: '어르신 명단' })).toBeInTheDocument()
  })

  it('이름과 내부 ID 를 함께 표시한다', async () => {
    renderApp()

    expect(await screen.findByText('김말순 (IB-001)')).toBeInTheDocument()
  })

  it('등록된 어르신이 없으면 비어 있다고 알린다', async () => {
    명단 = []
    renderApp()

    expect(await screen.findByText('아직 등록된 어르신이 없습니다.')).toBeInTheDocument()
  })
})

describe('어르신 등록 (n51 · n52 · n53)', () => {
  it('이름을 등록하면 목록에 내부 ID와 함께 나타난다', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('김말순 (IB-001)')

    await user.type(screen.getByLabelText('어르신 이름'), '홍길동')
    await user.click(screen.getByRole('button', { name: '등록' }))

    expect(await screen.findByText('홍길동 (IB-021)')).toBeInTheDocument()
  })

  it('이름이 비어 있으면 저장하지 않고 이름을 입력하도록 안내한다', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('김말순 (IB-001)')

    await user.click(screen.getByRole('button', { name: '등록' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('어르신 이름을 입력해 주세요.')
    expect(마지막_등록_요청).toBeNull()
  })

  it('동명이인이 있으면 저장을 막지 않고 확인을 요구한다 (n52)', async () => {
    const user = userEvent.setup()
    등록_응답 = {
      status: 409,
      body: { code: 'DUPLICATE_RECIPIENT_NAME', message: '이미 등록되어 있습니다.', fields: [] },
    }
    renderApp()
    await screen.findByText('김말순 (IB-001)')

    await user.type(screen.getByLabelText('어르신 이름'), '김말순')
    await user.click(screen.getByRole('button', { name: '등록' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('IB-001')
    expect(screen.getByRole('button', { name: '확인하고 등록' })).toBeInTheDocument()
  })

  it('동명이인을 확인하면 그대로 저장한다 (n53)', async () => {
    const user = userEvent.setup()
    등록_응답 = {
      status: 409,
      body: { code: 'DUPLICATE_RECIPIENT_NAME', message: '이미 등록되어 있습니다.', fields: [] },
    }
    renderApp()
    await screen.findByText('김말순 (IB-001)')

    await user.type(screen.getByLabelText('어르신 이름'), '김말순')
    await user.click(screen.getByRole('button', { name: '등록' }))
    await screen.findByRole('button', { name: '확인하고 등록' })

    등록_응답 = { status: 201, body: 어르신({ id: 3, name: '김말순', code: 'IB-021' }) }
    await user.click(screen.getByRole('button', { name: '확인하고 등록' }))

    expect(await screen.findByText('김말순 (IB-021)')).toBeInTheDocument()
    expect(마지막_등록_요청).toEqual({ name: '김말순', confirmDuplicateName: true })
  })
})

describe('어르신 이름 수정 (n54)', () => {
  it('이름을 고쳐도 내부 ID는 그대로다', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('김말순 (IB-001)')

    await user.click(screen.getByRole('button', { name: '이름 수정' }))
    const 입력 = screen.getByLabelText('IB-001')
    await user.clear(입력)
    await user.type(입력, '김말자')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('김말자 (IB-001)')).toBeInTheDocument()
  })
})

describe('이용 종료 표시 (n55)', () => {
  it('확인을 거친 뒤에만 표시하고, 명단에는 상태와 함께 남는다', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('김말순 (IB-001)')

    await user.click(screen.getByRole('button', { name: '이용 종료' }))
    expect(screen.getByRole('alert')).toHaveTextContent('기존 기록은 그대로 남습니다')

    await user.click(screen.getByRole('button', { name: '이용 종료로 표시' }))

    const 줄 = (await screen.findByText('김말순 (IB-001)')).closest('div')
    expect(within(줄 as HTMLElement).getByText('이용 종료')).toBeInTheDocument()
  })

  it('이용 종료한 어르신은 현장 입력의 대상 목록에서 빠진다', async () => {
    명단 = [어르신({ dischargedAt: '2026-08-13T10:00:00' }), 어르신({ id: 2, name: '박순자', code: 'IB-002' })]
    const user = userEvent.setup()

    seedStaffCache()
    saveSession({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SessionProvider>
          <MemoryRouter initialEntries={['/field/handovers/new']}>
            <AppRoutes />
          </MemoryRouter>
        </SessionProvider>
      </QueryClientProvider>,
    )

    await user.click(await screen.findByRole('button', { name: /직접 관찰/ }))

    expect(screen.queryByText(/김말순/)).not.toBeInTheDocument()
  })
})
