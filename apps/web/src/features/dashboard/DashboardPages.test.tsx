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
import type { HandoverCard } from '../handover-card/handoverCardApi'
import type { TaskResponse } from '../task/taskApi'

/**
 * 당일 운영 현황 대시보드와 하원 미처리 브리핑. (Manyfast F-HQTFLK, #16)
 *
 * 여기서 보는 것은 네 가지다. 인계·미처리·완료가 **구분돼** 보이는가, **한쪽 조회가 실패해도 성공한
 * 영역이 남는가**, **미처리 건수가 목록과 별도로 숫자로 뜨는가**, 그리고 대리 완료 표시가 목록에서도
 * 맞는가.
 *
 * 노드 번호는 유저플로우 "AI 인계 도구 내비게이션 맵" 기준이다.
 */

const 김하늘 = TEST_STAFF[0]

/** 카드 상세로 넘어가는 경로까지 보므로 카드도 실제 응답 모양 그대로 만든다. */
function 카드(patch: Partial<HandoverCard> = {}): HandoverCard {
  return {
    id: 31,
    handoverId: 12,
    careRecipientId: 1,
    careRecipientName: '김말순',
    observedAt: '2026-08-13T12:40:00',
    statusChange: '점심 식사량 저하',
    actionTaken: null,
    nextAction: '저녁 식사량 확인',
    evidenceText: '점심을 거의 안 드셨어요',
    safetyRelated: false,
    safetyFlagSource: null,
    reviewStatus: 'NEEDS_REVIEW',
    suggestedJobRole: 'NURSE_AIDE',
    suggestedDueTime: '17:30',
    exportAllowed: false,
    exportBlockedReason: '검토 완료 후 생성할 수 있습니다.',
    hasAudio: false,
    suggestedActions: [],
    createdAt: '2026-08-13T13:11:02.401',
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
    createdAt: '2026-08-13T14:02:11.402',
    ...patch,
  }
}

function 완료업무(patch: Partial<TaskResponse> = {}): TaskResponse {
  return 업무({
    id: 3,
    content: '낮잠 여부 확인',
    dueTime: '15:00',
    status: 'DONE',
    statusLabel: '완료',
    completedAt: '2026-08-13T15:20:00',
    completedByName: '박간호',
    ...patch,
  })
}

type Outcome = { status: number; body: unknown }

let 카드_응답: Outcome
let 업무_응답: Outcome
let 브리핑_응답: Outcome

beforeEach(() => {
  카드_응답 = {
    status: 200,
    body: {
      date: '2026-08-13',
      recipients: [
        { careRecipientId: 1, careRecipientName: '김말순', cards: [카드()] },
      ],
      unresolved: [],
    },
  }

  업무_응답 = {
    status: 200,
    body: { date: '2026-08-13', pending: [업무()], done: [완료업무()], pendingCount: 1, doneCount: 1 },
  }

  브리핑_응답 = {
    status: 200,
    body: { date: '2026-08-13', pending: [업무()], pendingCount: 1 },
  }

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      if (input.includes('/api/staff')) {
        return Promise.resolve(
          new Response(JSON.stringify({ staff: TEST_STAFF }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const 응답 = 응답을_고른다(input)
      return Promise.resolve(
        new Response(JSON.stringify(응답.body), {
          status: 응답.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
})

/** 브리핑 경로가 업무 목록 경로로 시작하므로 더 긴 쪽을 먼저 본다. 서버 쪽 경로 매칭과 같은 주의다. */
function 응답을_고른다(input: string): Outcome {
  if (input.includes('/api/tasks/pending-briefing')) {
    return 브리핑_응답
  }
  if (input.includes('/api/tasks')) {
    return 업무_응답
  }
  if (input.includes('/api/handover-cards')) {
    return 카드_응답
  }
  throw new Error(`테스트가 예상하지 못한 호출입니다: ${input}`)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderApp(initialPath = '/admin/dashboard', entryRole: 'FIELD_WORKER' | 'MANAGER' = 'MANAGER') {
  seedStaffCache()
  saveSession({ entryRole, staff: 김하늘 })
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

function 영역(name: string) {
  return within(screen.getByRole('region', { name }))
}

describe('당일 운영 현황 대시보드 (n42 관리자 대시보드 · n43 당일 인계·업무 현황)', () => {
  it('당일 인계 · 미처리 · 완료를 구분해 보여 준다', async () => {
    renderApp()

    expect(await screen.findByText('저녁 식사량 확인')).toBeInTheDocument()

    expect(영역('당일 인계').getByText('김말순')).toBeInTheDocument()
    expect(영역('당일 인계').getByText('점심 식사량 저하')).toBeInTheDocument()
    expect(영역('미처리 업무').getByText('저녁 식사량 확인')).toBeInTheDocument()
    expect(영역('완료 업무').getByText('낮잠 여부 확인')).toBeInTheDocument()

    // 미처리 업무가 완료 영역에 섞이지 않는다.
    expect(영역('완료 업무').queryByText('저녁 식사량 확인')).toBeNull()
  })

  it('업무에 담당 · 기한 · 상태가 함께 나온다', async () => {
    renderApp()

    const 미처리 = 영역('미처리 업무')
    expect(await 미처리.findByText('17:30까지')).toBeInTheDocument()
    // 담당 · 상태는 한 줄로 함께 나온다. 셋 중 하나만 빠져도 "누가 언제까지 무엇을"이 안 닫힌다.
    expect(미처리.getByText('박간호 · 간호조무사 · 미처리')).toBeInTheDocument()
  })

  it('업무에서 인계 카드로 이동할 수 있다', async () => {
    const user = userEvent.setup()
    renderApp()

    const 미처리 = 영역('미처리 업무')
    await user.click(await 미처리.findByRole('link', { name: '인계 카드 보기' }))

    // n46 인계 카드로 이동 → n18 인계 카드 상세 화면. 카드 상세는 어르신 이름을 제목으로 연다.
    expect(await screen.findByRole('heading', { name: '김말순', level: 1 })).toBeInTheDocument()
    // 근거 원문은 따옴표와 텍스트가 다른 노드로 나뉘어 그려진다.
    expect(screen.getByText(/점심을 거의 안 드셨어요/)).toBeInTheDocument()
  })

  it('업무 조회가 실패해도 인계 영역은 그대로 남는다', async () => {
    업무_응답 = { status: 500, body: { code: 'UNKNOWN_ERROR', message: '서버 오류' } }
    renderApp()

    // 실패한 영역에만 안내가 붙는다. (Manyfast F-HQTFLK exceptions)
    expect(await 영역('미처리 업무').findByRole('alert')).toHaveTextContent('업무를 불러오지 못했습니다')
    expect(영역('당일 인계').getByText('점심 식사량 저하')).toBeInTheDocument()
    expect(영역('당일 인계').queryByRole('alert')).toBeNull()
  })

  it('인계 조회가 실패해도 업무 영역은 그대로 남는다', async () => {
    카드_응답 = { status: 500, body: { code: 'UNKNOWN_ERROR', message: '서버 오류' } }
    renderApp()

    expect(await 영역('당일 인계').findByRole('alert')).toHaveTextContent('인계 카드를 불러오지 못했습니다')
    expect(영역('미처리 업무').getByText('저녁 식사량 확인')).toBeInTheDocument()
  })

  it('등록된 항목이 없으면 영역마다 없다고 알린다', async () => {
    카드_응답 = { status: 200, body: { date: '2026-08-13', recipients: [], unresolved: [] } }
    업무_응답 = {
      status: 200,
      body: { date: '2026-08-13', pending: [], done: [], pendingCount: 0, doneCount: 0 },
    }
    renderApp()

    expect(await screen.findByText('오늘 등록된 인계가 없습니다.')).toBeInTheDocument()
    expect(screen.getByText('아직 안 닫힌 업무가 없습니다.')).toBeInTheDocument()
    expect(screen.getByText('오늘 완료된 업무가 없습니다.')).toBeInTheDocument()
  })

  it('어르신을 가리지 못한 인계는 인계 영역에서만 따로 알린다', async () => {
    카드_응답 = {
      status: 200,
      body: {
        ...(카드_응답.body as object),
        unresolved: [카드({ id: 44, careRecipientId: null, careRecipientName: null })],
      },
    }
    renderApp()

    // 업무에는 이런 항목이 있을 수 없다. 대상 어르신을 가리지 못한 카드에서는 업무 생성이 막힌다.
    const 안내 = await 영역('당일 인계').findByRole('link', { name: /가리지 못한 항목이 1건/ })
    expect(안내).toHaveAttribute('href', '/handover-cards/unresolved')
  })

  it('미처리 영역에 건수를 함께 붙인다', async () => {
    renderApp()

    await screen.findByText('저녁 식사량 확인')
    expect(영역('미처리 업무').getByText('1건')).toBeInTheDocument()
  })

  it('건수는 목록 길이가 아니라 pendingCount 를 그린다', async () => {
    // 목록을 잘라 보여 주더라도 "오늘 몇 건이 안 닫혔는가"는 줄면 안 된다. (task-api.md)
    업무_응답 = {
      status: 200,
      body: { date: '2026-08-13', pending: [업무()], done: [], pendingCount: 7, doneCount: 0 },
    }
    renderApp()

    expect(await 영역('미처리 업무').findByText('7건')).toBeInTheDocument()
    expect(영역('미처리 업무').queryByText('1건')).toBeNull()
  })

  it('영역 이름은 건수에 끌려가지 않는다', async () => {
    renderApp()

    // 건수를 제목 안에 넣으면 영역 이름이 매일 바뀐다. 제목과 나란히 두고 이름은 고정한다.
    await screen.findByText('저녁 식사량 확인')
    expect(screen.getByRole('region', { name: '미처리 업무' })).toBeInTheDocument()
  })
})

describe('하원 미처리 브리핑 (n48 브리핑 선택 → n44 브리핑 · n45 미처리 건수·목록)', () => {
  it('대시보드에서 브리핑으로 이동한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('link', { name: '하원 미처리 브리핑 열기' }))

    expect(await screen.findByRole('heading', { name: '하원 미처리 브리핑' })).toBeInTheDocument()
  })

  it('미처리만 보여 주고 다음 날로 넘어가지 않는다고 알린다', async () => {
    renderApp('/admin/briefing')

    expect(await screen.findByText('저녁 식사량 확인')).toBeInTheDocument()
    expect(screen.getByText(/다음 날로 넘어가지 않습니다/)).toBeInTheDocument()
    expect(screen.queryByText('낮잠 여부 확인')).toBeNull()
  })

  it('브리핑은 대시보드 응답을 재사용하지 않고 자기 경로로 묻는다', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('저녁 식사량 확인')

    await user.click(screen.getByRole('link', { name: '하원 미처리 브리핑 열기' }))
    await screen.findByRole('heading', { name: '하원 미처리 브리핑' })

    // 이 호출이 서버의 브리핑 확인 기록이다. 캐시로 때우면 기록이 남지 않는다.
    const 호출 = vi.mocked(fetch).mock.calls.map(([input]) => String(input))
    expect(호출.some((path) => path.includes('/api/tasks/pending-briefing'))).toBe(true)
  })

  it('미처리 건수를 목록과 별도로 숫자로 보여 준다', async () => {
    // 이 화면이 파는 것은 목록이 아니라 숫자다. (Manyfast R-MFISQE 수락기준, n45 미처리 건수·목록)
    브리핑_응답 = {
      status: 200,
      body: { date: '2026-08-13', pending: [업무()], pendingCount: 4 },
    }
    renderApp('/admin/briefing')

    // 목록에 한 건만 실려 와도 숫자는 서버가 센 값 그대로다.
    expect(await screen.findByText('4건')).toBeInTheDocument()
    expect(screen.getByText('저녁 식사량 확인')).toBeInTheDocument()
  })

  it('미처리가 없으면 0건과 함께 없다고 알린다', async () => {
    브리핑_응답 = { status: 200, body: { date: '2026-08-13', pending: [], pendingCount: 0 } }
    renderApp('/admin/briefing')

    expect(await screen.findByText('지금 미처리로 남은 업무가 없습니다.')).toBeInTheDocument()
    // 0 도 답이다. 오늘 넘어간 것이 없다는 것을 숫자로 남긴다.
    expect(screen.getByText('0건')).toBeInTheDocument()
  })

  it('불러오지 못하면 다시 불러올 수 있다', async () => {
    브리핑_응답 = { status: 500, body: { code: 'UNKNOWN_ERROR', message: '서버 오류' } }
    renderApp('/admin/briefing')

    expect(await screen.findByRole('alert')).toHaveTextContent('업무를 불러오지 못했습니다')
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
  })
})

describe('대리 완료 표시', () => {
  it('확인자가 담당자와 다르면 대리 완료로 표시한다', async () => {
    업무_응답 = {
      status: 200,
      body: {
        date: '2026-08-13',
        pending: [],
        done: [완료업무({ completedByName: '이복지', delegated: true })],
        pendingCount: 0,
        doneCount: 1,
      },
    }
    renderApp()

    const 완료 = 영역('완료 업무')
    expect(await 완료.findByText(/이복지 확인/)).toBeInTheDocument()
    expect(완료.getByText('대리 완료')).toBeInTheDocument()
  })

  it('본인이 닫았으면 확인자만 보여 준다', async () => {
    renderApp()

    const 완료 = 영역('완료 업무')
    expect(await 완료.findByText(/박간호 확인/)).toBeInTheDocument()
    expect(완료.queryByText('대리 완료')).toBeNull()
  })

  it('직종만 배정된 업무는 대리라고 말하지 않는다', async () => {
    업무_응답 = {
      status: 200,
      body: {
        date: '2026-08-13',
        pending: [],
        // 담당자가 사람 단위로 정해진 적이 없으면 서버가 delegated 를 거짓으로 준다.
        done: [완료업무({ assigneeName: null, completedByName: '이복지', delegated: false })],
        pendingCount: 0,
        doneCount: 1,
      },
    }
    renderApp()

    const 완료 = 영역('완료 업무')
    expect(await 완료.findByText(/이복지 확인/)).toBeInTheDocument()
    expect(완료.queryByText('대리 완료')).toBeNull()
    expect(완료.getByText(/간호조무사/)).toBeInTheDocument()
  })
})

describe('진입 역할', () => {
  it('현장 근무자는 운영 현황을 주소로 열어도 자기 홈으로 간다', () => {
    renderApp('/admin/dashboard', 'FIELD_WORKER')

    expect(screen.getByRole('heading', { name: '현장 홈' })).toBeInTheDocument()
  })
})
