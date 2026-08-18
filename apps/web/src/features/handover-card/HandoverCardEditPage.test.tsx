import { render, screen } from '@testing-library/react'
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

/**
 * 카드 API 를 대신하는 아주 작은 서버.
 *
 * 저장한 뒤 화면이 다시 목록을 받아 올 수 있으므로, 응답을 고정해 두면 방금 저장한 내용이 되돌아간
 * 것처럼 보인다. 그래서 고친 내용을 **들고 있는** 쪽으로 만든다. 어르신 묶음과 검토 필요 항목을 가르는
 * 규칙도 서버와 같게 둔다. (`docs/contracts/handover-card-schema.md`)
 */
let 저장된_카드들: HandoverCard[]
let 호출들: { method: string; url: string; body: unknown }[]

function 목록_본문() {
  const 확정 = 저장된_카드들.filter((card) => card.careRecipientId !== null)
  const 어르신들 = [...new Set(확정.map((card) => card.careRecipientId))]

  return {
    date: '2026-08-11',
    recipients: 어르신들.map((id) => ({
      careRecipientId: id,
      careRecipientName: 확정.find((card) => card.careRecipientId === id)?.careRecipientName,
      cards: 확정.filter((card) => card.careRecipientId === id),
    })),
    unresolved: 저장된_카드들.filter((card) => card.careRecipientId === null),
  }
}

function 카드_찾기(url: string): HandoverCard {
  const id = Number(/handover-cards\/(\d+)/.exec(url)?.[1])
  const found = 저장된_카드들.find((card) => card.id === id)
  if (found === undefined) {
    throw new Error(`테스트 서버에 없는 카드입니다: ${url}`)
  }
  return found
}

function 다시_판정(card: HandoverCard): HandoverCard {
  const allowed = card.reviewStatus === 'REVIEWED' && card.careRecipientId !== null
  return {
    ...card,
    exportAllowed: allowed,
    exportBlockedReason: allowed ? null : '검토 완료 후 생성할 수 있습니다.',
  }
}

function 갈아끼우기(card: HandoverCard): HandoverCard {
  const 판정된 = 다시_판정(card)
  저장된_카드들 = 저장된_카드들.map((each) => (each.id === 판정된.id ? 판정된 : each))
  return 판정된
}

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

beforeEach(() => {
  저장된_카드들 = [카드()]
  호출들 = []

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const body = init?.body === undefined ? null : JSON.parse(String(init.body))
      호출들.push({ method, url, body })

      if (url.includes('/api/care-recipients')) {
        return json({
          careRecipients: [
            { id: 1, name: '김말순', code: 'A-01' },
            { id: 2, name: '박순자', code: 'A-02' },
          ],
        })
      }

      if (method === 'GET' && url.includes('/api/handover-cards')) {
        return json(목록_본문())
      }

      if (method === 'PUT') {
        const 고칠_카드 = 카드_찾기(url)
        const 요청 = body as Record<string, string | number | null>
        return json(
          갈아끼우기({
            ...고칠_카드,
            careRecipientId: 요청.careRecipientId as number | null,
            careRecipientName:
              요청.careRecipientId === null ? null : 요청.careRecipientId === 2 ? '박순자' : '김말순',
            statusChange: 요청.statusChange as string | null,
            actionTaken: 요청.actionTaken as string | null,
            nextAction: 요청.nextAction as string | null,
            suggestedJobRole: 요청.suggestedJobRole as HandoverCard['suggestedJobRole'],
            suggestedDueTime: 요청.suggestedDueTime as string | null,
          }),
        )
      }

      if (method === 'PATCH' && url.endsWith('/review-status')) {
        const 카드하나 = 카드_찾기(url)
        const 요청 = body as { reviewStatus: HandoverCard['reviewStatus'] }
        if (요청.reviewStatus === 'REVIEWED' && 카드하나.careRecipientId === null) {
          return json(
            {
              code: 'CARE_RECIPIENT_NOT_RESOLVED',
              message: '대상 어르신을 먼저 지정해 주세요.',
              fields: [],
            },
            409,
          )
        }
        return json(갈아끼우기({ ...카드하나, reviewStatus: 요청.reviewStatus }))
      }

      if (method === 'PATCH' && url.endsWith('/safety')) {
        const 카드하나 = 카드_찾기(url)
        const 요청 = body as { safetyRelated: boolean }
        return json(
          갈아끼우기({
            ...카드하나,
            safetyRelated: 요청.safetyRelated,
            safetyFlagSource: 요청.safetyRelated ? 'STAFF' : null,
          }),
        )
      }

      throw new Error(`테스트가 예상하지 못한 호출입니다: ${method} ${url}`)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderApp(initialPath = '/handover-cards/31/edit') {
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

describe('검토·수정 화면으로 들어가기 (n21 · n24 → n25)', () => {
  it('카드 상세에서 들어간다', async () => {
    const user = userEvent.setup()
    renderApp('/handover-cards/31')

    await user.click(await screen.findByRole('link', { name: '카드 검토·수정하기' }))

    // 화면 제목은 AppHeader 2행이 보여준다 — 본문에 별도 heading을 두지 않는다(#88 후속 코멘트).
    expect(await screen.findByText('카드 검토·수정')).toBeInTheDocument()
  })

  it('검토 필요 항목 화면에서 어르신을 지정하러 들어간다', async () => {
    저장된_카드들 = [카드({ id: 40, careRecipientId: null, careRecipientName: null })]
    const user = userEvent.setup()
    renderApp('/handover-cards/unresolved')

    await user.click(await screen.findByRole('link', { name: '어르신 지정하고 고치기' }))

    expect(await screen.findByText('카드 검토·수정')).toBeInTheDocument()
  })

  it('카드가 들고 있던 값으로 채워져 열린다', async () => {
    renderApp()

    expect(await screen.findByLabelText('상태 변화')).toHaveValue('점심 식사량 저하')
    expect(screen.getByLabelText('다음 행동')).toHaveValue('저녁 식사량 확인')
    expect(screen.getByLabelText('제안 기한')).toHaveValue('17:00')
  })

  it('근거 원문과 관찰 시각은 고칠 수 없다고 알린다', async () => {
    renderApp()

    expect(await screen.findByText(/점심을 거의 안 드셨어요/)).toBeInTheDocument()
    expect(screen.getByText(/원문에서 읽은 값이라 고치지 않습니다/)).toBeInTheDocument()
  })
})

describe('AI 추천 액션 칩 (F-SNBVHR action · display — RFC #62 방향 A)', () => {
  it('칩을 탭하면 해당 칸이 채워지고 직접 수정할 수 있다', async () => {
    저장된_카드들 = [
      카드({
        suggestedActions: [
          { targetField: 'ACTION_TAKEN', text: '죽으로 바꿔 드림' },
          { targetField: 'NEXT_ACTION', text: '저녁 식사량 재확인' },
        ],
      }),
    ]
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: '죽으로 바꿔 드림' }))
    expect(await screen.findByLabelText('조치')).toHaveValue('죽으로 바꿔 드림')

    await user.click(screen.getByRole('button', { name: '저녁 식사량 재확인' }))
    expect(screen.getByLabelText('다음 행동')).toHaveValue('저녁 식사량 재확인')

    // 탭한 뒤에도 textarea 를 직접 고칠 수 있다.
    await user.type(screen.getByLabelText('조치'), ' — 절반 드심')
    expect(screen.getByLabelText('조치')).toHaveValue('죽으로 바꿔 드림 — 절반 드심')
  })

  it('추천할 내용이 없으면 칩 영역이 보이지 않는다', async () => {
    renderApp()

    await screen.findByLabelText('조치')
    expect(screen.queryByRole('button', { name: '죽으로 바꿔 드림' })).not.toBeInTheDocument()
  })
})

describe('카드 항목 수정 (n25 → n21)', () => {
  it('고쳐서 저장하면 카드 상세로 돌아가고 고친 내용이 보인다', async () => {
    const user = userEvent.setup()
    renderApp()

    const 조치 = await screen.findByLabelText('조치')
    await user.type(조치, '죽으로 바꿔 드림')
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('heading', { name: /^김말순/ })).toBeInTheDocument()
    expect(screen.getByText('죽으로 바꿔 드림')).toBeInTheDocument()
  })

  it('제안 담당 직종을 바꿔서 저장한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: '간호조무사' }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByText('제안 · 간호조무사 · 17:00까지')).toBeInTheDocument()
  })

  it('세 항목을 모두 비우면 서버에 보내지 않고 보완할 항목을 알린다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.clear(await screen.findByLabelText('상태 변화'))
    await user.clear(screen.getByLabelText('다음 행동'))
    await user.click(screen.getByRole('button', { name: '간호조무사' })) // 제안 직종 해제
    await user.clear(screen.getByLabelText('제안 기한'))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('하나는 남겨 주세요')
    expect(호출들.some((call) => call.method === 'PUT')).toBe(false)
  })
})

describe('검토 상태 전환', () => {
  it('저장하고 검토 완료를 누르면 검토 완료가 되어 상세로 돌아간다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: '저장하고 검토 완료' }))

    expect(await screen.findByRole('heading', { name: /^김말순/ })).toBeInTheDocument()
    expect(screen.getByText('검토 완료')).toBeInTheDocument()
  })

  it('검토 완료 카드는 문구 출력 흐름으로 갈 수 있다', async () => {
    저장된_카드들 = [
      카드({ reviewStatus: 'REVIEWED', exportAllowed: true, exportBlockedReason: null }),
    ]
    renderApp('/handover-cards/31')

    const 링크 = await screen.findByRole('link', { name: '기록·보호자 전달 문구 만들기' })
    expect(링크).toHaveAttribute('href', '/handover-cards/31/export')
  })

  it('검토 전 카드에는 문구를 만들 수 없는 이유를 서버가 준 대로 보여 준다', async () => {
    renderApp('/handover-cards/31')

    expect(await screen.findByText('검토 완료 후 생성할 수 있습니다.')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: '기록·보호자 전달 문구 만들기' }),
    ).not.toBeInTheDocument()
  })

  it('검토 완료를 되돌릴 수 있다', async () => {
    저장된_카드들 = [
      카드({ reviewStatus: 'REVIEWED', exportAllowed: true, exportBlockedReason: null }),
    ]
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: '검토 필요로 되돌리기' }))

    expect(await screen.findByText('검토 필요로 되돌렸습니다.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '저장하고 검토 완료' })).toBeInTheDocument()
  })

  it('어르신을 가리지 못한 카드는 저장은 되고 검토 완료만 막힌다', async () => {
    저장된_카드들 = [카드({ id: 40, careRecipientId: null, careRecipientName: null })]
    const user = userEvent.setup()
    renderApp('/handover-cards/40/edit')

    await user.click(await screen.findByRole('button', { name: '저장하고 검토 완료' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('고친 내용은 저장했습니다')
    expect(screen.getByRole('alert')).toHaveTextContent('대상 어르신을 먼저 지정해 주세요.')
    expect(호출들.some((call) => call.method === 'PUT')).toBe(true)
  })
})

describe('대상 어르신 지정 (n24 → 확정)', () => {
  it('어르신을 지정해 저장하면 검토 필요 항목에서 빠진다', async () => {
    저장된_카드들 = [카드({ id: 40, careRecipientId: null, careRecipientName: null })]
    const user = userEvent.setup()
    renderApp('/handover-cards/40/edit')

    await user.click(await screen.findByRole('button', { name: /박순자/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('heading', { name: /^박순자/ })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '목록으로' }))
    expect(await screen.findByRole('heading', { name: /박순자/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /가리지 못한 항목/ })).not.toBeInTheDocument()
  })

  it('아직 모르겠으면 어르신을 비운 채로 둘 수 있다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: '아직 가리지 못했습니다' }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('heading', { name: '대상 어르신 미정' })).toBeInTheDocument()
  })
})

describe('안전 관련 직접 표시 (F-SNBVHR rules)', () => {
  it('직원이 안전 관련으로 표시하면 바로 반영된다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: '안전 관련으로 표시하기' }))

    expect(await screen.findByText('안전 관련')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '안전 관련 표시 해제하기' })).toBeInTheDocument()
    expect(호출들.some((call) => call.url.endsWith('/safety'))).toBe(true)
  })

  it('표시를 해제할 수도 있다', async () => {
    저장된_카드들 = [카드({ safetyRelated: true, safetyFlagSource: 'KEYWORD' })]
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: '안전 관련 표시 해제하기' }))

    expect(await screen.findByRole('button', { name: '안전 관련으로 표시하기' })).toBeInTheDocument()
    expect(screen.queryByText('안전 관련')).not.toBeInTheDocument()
  })
})

describe('AI 가 확신하지 못한 항목 강조 (F-SNBVHR display)', () => {
  it('AI 가 비워서 내려보낸 자리를 모아 알린다', async () => {
    저장된_카드들 = [
      카드({ id: 40, careRecipientId: null, careRecipientName: null, suggestedDueTime: null }),
    ]
    renderApp('/handover-cards/40')

    const 안내 = await screen.findByText(/AI가 채우지 못한 곳/)
    expect(안내).toHaveTextContent('대상 어르신 · 제안 기한')
  })

  it('다 채워진 카드에는 붙지 않는다', async () => {
    renderApp('/handover-cards/31')

    await screen.findByRole('heading', { name: /^김말순/ })
    expect(screen.queryByText(/AI가 채우지 못한 곳/)).not.toBeInTheDocument()
  })
})
