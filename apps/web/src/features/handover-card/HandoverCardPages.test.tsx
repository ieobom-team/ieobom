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
import type { HandoverCard } from './handoverCardApi'

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
    reviewStatus: 'NEEDS_REVIEW',
    suggestedJobRole: 'CAREGIVER',
    suggestedDueTime: '17:00',
    exportAllowed: false,
    exportBlockedReason: '검토 완료 후 생성할 수 있습니다.',
    createdAt: '2026-08-11T13:11:02.401',
    hasAudio: false,
    suggestedActions: [],
    ...patch,
  }
}

type Outcome = { status: number; body: unknown }

let 목록_응답: Outcome

beforeEach(() => {
  목록_응답 = {
    status: 200,
    body: {
      date: '2026-08-11',
      recipients: [
        {
          careRecipientId: 1,
          careRecipientName: '김말순',
          cards: [카드()],
        },
      ],
      unresolved: [],
    },
  }

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      // 안전 표시는 고쳐진 카드 한 장을 돌려준다. 판정 출처는 서버가 붙인다
      if (input.endsWith('/safety')) {
        const { safetyRelated } = JSON.parse(String(init?.body)) as { safetyRelated: boolean }
        return Promise.resolve(
          new Response(
            JSON.stringify(
              카드({ safetyRelated, safetyFlagSource: safetyRelated ? 'STAFF' : null }),
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }
      if (input.includes('/api/handover-cards')) {
        return Promise.resolve(
          new Response(JSON.stringify(목록_응답.body), {
            status: 목록_응답.status,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      // 현장 홈 요약 카드가 함께 부른다. 이 파일은 인계 카드 화면만 본다 — 빈 목록으로 둔다.
      if (input.includes('/api/tasks')) {
        return Promise.resolve(
          new Response(JSON.stringify({ date: '2026-08-11', tasks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      throw new Error(`테스트가 예상하지 못한 호출입니다: ${input}`)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderApp(
  initialPath = '/handover-cards',
  entryRole: 'FIELD_WORKER' | 'MANAGER' = 'FIELD_WORKER',
) {
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

describe('인계 카드 목록 (n18 · n19)', () => {
  it('현장 홈에서 들어올 수 있다', async () => {
    const user = userEvent.setup()
    renderApp('/field')

    await user.click(screen.getByRole('button', { name: /^인계 카드/ }))

    expect(await screen.findByText('오늘의 인계 카드')).toBeInTheDocument()
  })

  it('어르신 이름을 카드 헤더에 함께 보여 준다', async () => {
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          { careRecipientId: 1, careRecipientName: '김말순', cards: [카드({ id: 31 })] },
          {
            careRecipientId: 2,
            careRecipientName: '박순자',
            cards: [카드({ id: 32, careRecipientId: 2, careRecipientName: '박순자' })],
          },
        ],
        unresolved: [],
      },
    }
    renderApp()

    expect(await screen.findByRole('heading', { name: /김말순/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /박순자/ })).toBeInTheDocument()
  })

  it('상태 변화 · 조치 · 다음 행동을 구분해 보여 주고, 없는 항목도 없다고 알린다', async () => {
    renderApp()

    const card = await screen.findByRole('link', { name: /점심 식사량 저하/ })
    expect(within(card).getByText('상태 변화')).toBeInTheDocument()
    expect(within(card).getByText('조치')).toBeInTheDocument()
    expect(within(card).getByText('다음 행동')).toBeInTheDocument()
    expect(within(card).getByText('없음')).toBeInTheDocument()
  })

  it('근거 원문을 카드에서 바로 보여 준다', async () => {
    renderApp()

    const card = await screen.findByRole('link', { name: /점심 식사량 저하/ })
    expect(within(card).getByText('근거 원문')).toBeInTheDocument()
    expect(within(card).getByText(/점심을 거의 안 드셨어요/)).toBeInTheDocument()
  })

  /**
   * 원본 음성 재생. (#44 · Manyfast F-SNBVHR)
   *
   * 재생 여부는 입력 방식이 아니라 저장된 음성이 있는지(`hasAudio`)로 갈린다 — 마이크 권한을
   * 거부한 음성 입력에도 방식은 `VOICE` 로 남기 때문이다.
   */
  it('원본 음성이 있으면 근거 원문과 함께 재생할 수 있게 둔다', async () => {
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          {
            careRecipientId: 1,
            careRecipientName: '김말순',
            cards: [카드({ hasAudio: true })],
          },
        ],
        unresolved: [],
      },
    }
    renderApp()

    const card = await screen.findByRole('link', { name: /점심 식사량 저하/ })
    // 텍스트 근거를 대체하지 않고 함께 둔다
    expect(within(card).getByText(/점심을 거의 안 드셨어요/)).toBeInTheDocument()
    const player = within(card).getByLabelText('원본 음성 재생')
    expect(player).toHaveAttribute('src', '/api/handovers/12/audio')
  })

  it('저장된 원본 음성이 없으면 재생을 내보이지 않는다', async () => {
    renderApp()

    const card = await screen.findByRole('link', { name: /점심 식사량 저하/ })
    expect(within(card).queryByLabelText('원본 음성 재생')).not.toBeInTheDocument()
  })

  it('안전 관련 항목을 카드 묶음 맨 위에 둔다', async () => {
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          {
            careRecipientId: 1,
            careRecipientName: '김말순',
            cards: [
              카드({ id: 31, statusChange: '기침', safetyRelated: false, createdAt: '2026-08-11T10:00:00' }),
              카드({
                id: 32,
                statusChange: '복도에서 넘어지심',
                safetyRelated: true,
                safetyFlagSource: 'KEYWORD',
                createdAt: '2026-08-11T09:00:00',
              }),
            ],
          },
        ],
        unresolved: [],
      },
    }
    renderApp()

    const cards = await screen.findAllByRole('link', { name: /상태 변화/ })
    expect(cards[0]).toHaveTextContent('복도에서 넘어지심')
    expect(cards[0]).toHaveTextContent('안전 관련')
    expect(cards[1]).toHaveTextContent('기침')
  })

  it('기본 진입 시 검토 필요 카드만 노출되고 완료 카드는 접어둔다', async () => {
    const user = userEvent.setup()
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          {
            careRecipientId: 1,
            careRecipientName: '김말순',
            cards: [
              카드({ id: 31, statusChange: '기침', reviewStatus: 'NEEDS_REVIEW' }),
              카드({ id: 32, statusChange: '식사량 저하', reviewStatus: 'REVIEWED' }),
            ],
          },
        ],
        unresolved: [],
      },
    }
    renderApp()

    const 검토전 = await screen.findByRole('link', { name: /기침/ })
    expect(within(검토전).getByText('검토 필요')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /식사량 저하/ })).not.toBeInTheDocument()

    // 접힌 검토 완료 카드 열기
    await user.click(screen.getByRole('button', { name: /검토 완료 카드 1건 보기/ }))
    const 검토후 = await screen.findByRole('link', { name: /식사량 저하/ })
    expect(within(검토후).getByText('검토 완료')).toBeInTheDocument()
  })

  it('상단 탭 필터로 검토 완료나 안전 관련 카드를 모아볼 수 있다', async () => {
    const user = userEvent.setup()
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          {
            careRecipientId: 1,
            careRecipientName: '김말순',
            cards: [
              카드({ id: 31, statusChange: '기침', reviewStatus: 'NEEDS_REVIEW', safetyRelated: false }),
              카드({ id: 32, statusChange: '넘어지심', reviewStatus: 'REVIEWED', safetyRelated: true }),
            ],
          },
        ],
        unresolved: [],
      },
    }
    renderApp()

    await screen.findByRole('link', { name: /기침/ })

    // 안전 관련 탭 클릭
    await user.click(screen.getByRole('tab', { name: /안전 관련/ }))
    expect(await screen.findByRole('link', { name: /넘어지심/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /기침/ })).not.toBeInTheDocument()

    // 검토 완료 탭 클릭
    await user.click(screen.getByRole('tab', { name: /검토 완료/ }))
    expect(await screen.findByRole('link', { name: /넘어지심/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /기침/ })).not.toBeInTheDocument()
  })

  it('이름 검색으로 특정 어르신 카드만 실시간으로 모아볼 수 있다', async () => {
    const user = userEvent.setup()
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          { careRecipientId: 1, careRecipientName: '김말순', cards: [카드({ id: 31, statusChange: '김말순 특이사항' })] },
          { careRecipientId: 2, careRecipientName: '박순자', cards: [카드({ id: 32, careRecipientId: 2, careRecipientName: '박순자', statusChange: '박순자 특이사항' })] },
        ],
        unresolved: [],
      },
    }
    renderApp()

    await screen.findByRole('link', { name: /김말순 특이사항/ })
    expect(screen.getByRole('link', { name: /박순자 특이사항/ })).toBeInTheDocument()

    // 박순자로 검색
    await user.type(screen.getByLabelText('어르신 이름 검색'), '박순자')
    expect(screen.queryByRole('link', { name: /김말순 특이사항/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /박순자 특이사항/ })).toBeInTheDocument()
  })

  it('현황 요약 타일이 getCardStats 값을 정확히 보여준다', async () => {
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          {
            careRecipientId: 1,
            careRecipientName: '김말순',
            cards: [
              카드({ id: 31, reviewStatus: 'NEEDS_REVIEW' }),
              카드({ id: 32, reviewStatus: 'REVIEWED' }),
            ],
          },
        ],
        unresolved: [],
      },
    }
    renderApp()

    await screen.findByRole('link', { name: /점심 식사량 저하/ })
    // 라벨(전체/검토 필요/검토 완료)은 타일과 필터 칩에 함께 나오므로, 값은 타일 전용 접미사("개")로 짚는다
    expect(screen.getByText('2개')).toBeInTheDocument()
    expect(screen.getAllByText('1개')).toHaveLength(2)
  })

  it('당일 카드가 없으면 비어 있다고 알린다', async () => {
    목록_응답 = {
      status: 200,
      body: { date: '2026-08-11', recipients: [], unresolved: [] },
    }
    renderApp()

    expect(await screen.findByText(/아직 정리된 인계 카드가 없습니다/)).toBeInTheDocument()
  })

  it('불러오지 못하면 다시 시도할 수 있다', async () => {
    목록_응답 = { status: 500, body: { code: 'UNKNOWN', message: '오류', fields: [] } }
    renderApp()

    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다')
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
  })
})

describe('어르신을 가리지 못한 항목 (n23 negative → n24)', () => {
  beforeEach(() => {
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [{ careRecipientId: 1, careRecipientName: '김말순', cards: [카드()] }],
        unresolved: [
          카드({
            id: 40,
            careRecipientId: null,
            careRecipientName: null,
            statusChange: '한 분이 어지럽다고 하심',
          }),
        ],
      },
    }
  })

  it('어르신 목록에 섞지 않는다', async () => {
    renderApp()

    await screen.findByRole('heading', { name: /김말순/ })
    expect(screen.queryByText(/한 분이 어지럽다고 하심/)).not.toBeInTheDocument()
  })

  it('검토 필요 항목 화면에서 확인한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('link', { name: /가리지 못한 항목이 1건/ }))

    expect(await screen.findByRole('heading', { name: '검토 필요 항목' })).toBeInTheDocument()
    expect(screen.getByText(/한 분이 어지럽다고 하심/)).toBeInTheDocument()
  })

  it('가리지 못한 항목이 없으면 없다고 알린다', async () => {
    목록_응답 = {
      status: 200,
      body: { date: '2026-08-11', recipients: [], unresolved: [] },
    }
    renderApp('/handover-cards/unresolved')

    expect(await screen.findByText(/지금은 가리지 못한 항목이 없습니다/)).toBeInTheDocument()
  })
})

describe('인계 카드 상세 (n20 → n21 · n22)', () => {
  it('카드를 고르면 받아 둔 내용으로 상세를 바로 그린다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('link', { name: /점심 식사량 저하/ }))

    // 캐시에 이미 있으므로 "불러오는 중"을 거치지 않는다. 최신 확인은 뒤에서 따로 한다.
    expect(screen.getByRole('heading', { name: '김말순' })).toBeInTheDocument()
    expect(screen.queryByText(/불러오는 중/)).not.toBeInTheDocument()
  })

  it('근거 원문과 관찰 시각, 다음 행동 제안값을 함께 보여 준다', async () => {
    renderApp('/handover-cards/31')

    expect(await screen.findByText(/점심을 거의 안 드셨어요/)).toBeInTheDocument()
    expect(screen.getByText(/오늘 12:40에 있었던 일/)).toBeInTheDocument()
    expect(screen.getByText('제안 · 요양보호사 · 17:00까지')).toBeInTheDocument()
  })

  it('어르신을 가리지 못한 카드는 확정 카드가 아니라고 알린다', async () => {
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [],
        unresolved: [카드({ id: 40, careRecipientId: null, careRecipientName: null })],
      },
    }
    renderApp('/handover-cards/40')

    expect(await screen.findByRole('heading', { name: '대상 어르신 미정' })).toBeInTheDocument()
    expect(screen.getByText(/확정 카드가 되지 않습니다/)).toBeInTheDocument()
  })

  it('오늘 목록에 없는 카드는 찾지 못했다고 알린다', async () => {
    renderApp('/handover-cards/999')

    expect(await screen.findByText(/그 인계 카드를 찾지 못했습니다/)).toBeInTheDocument()
  })

  it('카드를 고치지 않고 안전 관련 표시만 켤 수 있다', async () => {
    const user = userEvent.setup()
    renderApp('/handover-cards/31')

    await user.click(await screen.findByRole('button', { name: '안전 관련으로 표시하기' }))

    expect(await screen.findByText('안전 관련')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '안전 관련 표시 해제하기' })).toBeInTheDocument()
  })

  it('안전 관련 표시를 해제할 수도 있다', async () => {
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          {
            careRecipientId: 1,
            careRecipientName: '김말순',
            cards: [카드({ safetyRelated: true, safetyFlagSource: 'KEYWORD' })],
          },
        ],
        unresolved: [],
      },
    }
    const user = userEvent.setup()
    renderApp('/handover-cards/31')

    await user.click(await screen.findByRole('button', { name: '안전 관련 표시 해제하기' }))

    expect(await screen.findByRole('button', { name: '안전 관련으로 표시하기' })).toBeInTheDocument()
    expect(screen.queryByText('안전 관련')).not.toBeInTheDocument()
  })

  it('관리자로 들어와도 같은 상세를 본다', async () => {
    renderApp('/handover-cards/31', 'MANAGER')

    expect(await screen.findByRole('heading', { name: '김말순' })).toBeInTheDocument()
  })
})
