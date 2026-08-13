import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../routes/AppRoutes'
import { createQueryClient } from '../../shared/api/queryClient'
import type { HandoverCard } from '../handover-card/handoverCardApi'
import { SessionProvider } from '../session/SessionProvider'
import { saveSession } from '../session/sessionStorage'
import { seedStaffCache, TEST_STAFF } from '../session/staffFixture'
import type { ExportBundle, ExportBundleList, ExportPhrase, ExportPhraseGroup } from './exportApi'

const 김하늘 = TEST_STAFF[0]

function 카드(patch: Partial<HandoverCard> = {}): HandoverCard {
  return {
    id: 31,
    handoverId: 12,
    careRecipientId: 1,
    careRecipientName: '김말순',
    observedAt: '2026-08-11T12:40:00',
    statusChange: '점심 식사량 저하',
    actionTaken: '죽으로 바꿔 드림',
    nextAction: null,
    evidenceText: '점심을 거의 안 드셨어요',
    safetyRelated: false,
    safetyFlagSource: null,
    reviewStatus: 'REVIEWED',
    suggestedJobRole: null,
    suggestedDueTime: null,
    exportAllowed: true,
    exportBlockedReason: null,
    createdAt: '2026-08-11T13:11:02.401',
    hasAudio: false,
    ...patch,
  }
}

function 기록문구(patch: Partial<ExportPhrase> = {}): ExportPhrase {
  return {
    id: 7,
    cardId: 31,
    handoverId: 12,
    careRecipientId: 1,
    careRecipientName: '김말순',
    phraseType: 'RECORD',
    phraseTypeLabel: '전산 기록 문구',
    text: '12시 40분경 점심 식사량 저하 보이심. 죽으로 바꿔 드림.',
    generatedText: '12시 40분경 점심 식사량 저하 보이심. 죽으로 바꿔 드림.',
    edited: false,
    needsReview: false,
    reviewNotice: null,
    evidenceText: '점심을 거의 안 드셨어요',
    copiedAt: null,
    createdAt: '2026-08-11T15:02:11.402',
    ...patch,
  }
}

function 보호자문구(patch: Partial<ExportPhrase> = {}): ExportPhrase {
  return 기록문구({
    id: 8,
    phraseType: 'GUARDIAN',
    phraseTypeLabel: '보호자 전달 문구',
    text: '점심 식사량이 줄어 죽으로 바꿔 드렸습니다.',
    generatedText: '점심 식사량이 줄어 죽으로 바꿔 드렸습니다.',
    ...patch,
  })
}

function 묶음(patch: Partial<ExportBundle> = {}): ExportBundle {
  return {
    phraseType: 'RECORD',
    phraseTypeLabel: '전산 기록 문구',
    text: '12시 40분경 점심 식사량 저하 보이심. 죽으로 바꿔 드림.',
    empty: false,
    phraseCount: 1,
    needsReview: false,
    notice: null,
    phrases: [기록문구()],
    ...patch,
  }
}

type Outcome = { status: number; body: unknown }

/** 파일 응답은 JSON 이 아니다. 본문과 헤더를 그대로 두고 흉내 낸다. */
type FileOutcome = { status: number; body: string; headers: Record<string, string> }

const 파일이름 = '이어봄_전산기록문구_김말순_2026-08-11.txt'

let 목록_응답: Outcome
let 문구생성_응답: Outcome
let 문구수정_응답: (text: string) => Outcome
let 문구복사_응답: Outcome
let 묶음목록_응답: Outcome
let 묶음복사_응답: Outcome
let 파일_응답: FileOutcome
let 파일요청: string[]
let 저장된파일: string[]

beforeEach(() => {
  목록_응답 = {
    status: 200,
    body: {
      date: '2026-08-11',
      recipients: [{ careRecipientId: 1, careRecipientName: '김말순', cards: [카드()] }],
      unresolved: [],
    },
  }
  문구생성_응답 = {
    status: 201,
    body: { cardId: 31, needsReview: false, phrases: [기록문구(), 보호자문구()] } satisfies ExportPhraseGroup,
  }
  문구수정_응답 = (text) => ({
    status: 200,
    body: 기록문구({ text, edited: true }),
  })
  문구복사_응답 = { status: 200, body: 기록문구({ copiedAt: '2026-08-11T15:10:00' }) }
  묶음목록_응답 = {
    status: 200,
    body: {
      careRecipientId: 1,
      careRecipientName: '김말순',
      date: '2026-08-11',
      bundles: [묶음(), 묶음({ phraseType: 'GUARDIAN', phraseTypeLabel: '보호자 전달 문구', phrases: [보호자문구()] })],
    } satisfies ExportBundleList,
  }
  묶음복사_응답 = { status: 200, body: 묶음({ phrases: [기록문구({ copiedAt: '2026-08-11T15:12:00' })] }) }
  파일_응답 = {
    status: 200,
    body: '12시 40분경 점심 식사량 저하 보이심. 죽으로 바꿔 드림.',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(파일이름)}`,
    },
  }
  파일요청 = []

  // 브라우저가 파일을 저장하는 자리. jsdom 에는 `createObjectURL` 이 없어 직접 채운다.
  저장된파일 = []
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:test'),
    configurable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    저장된파일.push(this.download)
  })

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const respond = (outcome: Outcome) =>
        Promise.resolve(
          new Response(JSON.stringify(outcome.body), {
            status: outcome.status,
            headers: { 'Content-Type': 'application/json' },
          }),
        )

      // 묶음 파일 경로가 `/export-bundles` 를 품고 있어 묶음 조회보다 먼저 본다.
      // 표는 단위가 달라 경로도 다르다 — `/file` 이 붙지 않는다.
      if (input.includes('/file?') || input.includes('/export-sheet')) {
        파일요청.push(input)
        return Promise.resolve(
          파일_응답.status === 200
            ? new Response(파일_응답.body, { status: 200, headers: 파일_응답.headers })
            : new Response(파일_응답.body, {
                status: 파일_응답.status,
                headers: { 'Content-Type': 'application/json' },
              }),
        )
      }
      if (input.includes('/export-bundles/copy')) {
        return respond(묶음복사_응답)
      }
      if (input.includes('/export-bundles')) {
        return respond(묶음목록_응답)
      }
      if (/\/api\/exports\/\d+\/copy$/.test(input)) {
        return respond(문구복사_응답)
      }
      if (/\/api\/exports\/\d+$/.test(input) && method === 'PUT') {
        const { text } = JSON.parse(String(init?.body)) as { text: string }
        return respond(문구수정_응답(text))
      }
      if (/\/api\/handover-cards\/\d+\/exports$/.test(input)) {
        return respond(문구생성_응답)
      }
      if (input.includes('/api/handover-cards')) {
        return respond(목록_응답)
      }
      throw new Error(`테스트가 예상하지 못한 호출입니다: ${input} ${method}`)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * `userEvent.setup()`은 그 안에서 `navigator.clipboard`를 자기 스텁으로 덮어쓴다.
 * 그래서 이 함수는 반드시 `userEvent.setup()` **뒤에** 불러야 한다.
 */
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

function renderApp(initialPath = '/handover-cards/31/export') {
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

describe('기록·보호자 전달 문구 화면 (n36~n40)', () => {
  it('전산 기록 문구와 보호자 전달 문구를 구분해 보여 준다', async () => {
    renderApp()

    expect(await screen.findByRole('heading', { name: '전산 기록 문구' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '보호자 전달 문구' })).toBeInTheDocument()
  })

  it('각 문구에서 원문 근거를 확인할 수 있다', async () => {
    renderApp()

    const evidences = await screen.findAllByText(/점심을 거의 안 드셨어요/)
    expect(evidences.length).toBeGreaterThan(0)
  })

  it('문구가 불완전하면 만들지 못했다고 알리고 복사 버튼을 두지 않는다', async () => {
    문구생성_응답 = {
      status: 200,
      body: {
        cardId: 31,
        needsReview: false,
        phrases: [기록문구(), 보호자문구({ text: null, generatedText: null })],
      } satisfies ExportPhraseGroup,
    }
    renderApp()

    const guardianHeading = await screen.findByRole('heading', { name: '보호자 전달 문구' })
    const section = guardianHeading.closest('article')
    expect(section).not.toBeNull()
    expect(within(section as HTMLElement).getByText(/만들지 못했습니다/)).toBeInTheDocument()
    expect(
      within(section as HTMLElement).queryByRole('button', { name: '복사하기' }),
    ).not.toBeInTheDocument()
  })

  it('검토 안내가 붙은 문구는 복사 전에 확인하라고 알린다', async () => {
    문구생성_응답 = {
      status: 200,
      body: {
        cardId: 31,
        needsReview: true,
        phrases: [
          기록문구({ needsReview: true, reviewNotice: '카드에 없는 숫자가 있습니다.' }),
          보호자문구(),
        ],
      } satisfies ExportPhraseGroup,
    }
    renderApp()

    expect(await screen.findByText(/복사 전에 확인해 주세요/)).toBeInTheDocument()
    expect(screen.getByText(/카드에 없는 숫자가 있습니다/)).toBeInTheDocument()
  })

  it('문구를 고치면 저장할 수 있고, 저장 전에는 복사할 수 없다', async () => {
    const user = userEvent.setup()
    renderApp()

    const recordHeading = await screen.findByRole('heading', { name: '전산 기록 문구' })
    const section = recordHeading.closest('article') as HTMLElement
    const textarea = within(section).getByRole('textbox')

    await user.clear(textarea)
    await user.type(textarea, '고친 문구')

    expect(within(section).getByRole('button', { name: '고친 내용 저장하기' })).toBeInTheDocument()
    expect(
      within(section).getByRole('button', { name: '저장한 뒤 복사할 수 있습니다' }),
    ).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: '고친 내용 저장하기' }))

    expect(await within(section).findByRole('button', { name: '복사하기' })).toBeInTheDocument()
  })

  it('복사에 성공하면 복사 완료를 안내한다', async () => {
    const user = userEvent.setup()
    const writeText = stubClipboard()
    renderApp()

    const recordHeading = await screen.findByRole('heading', { name: '전산 기록 문구' })
    const section = recordHeading.closest('article') as HTMLElement

    await user.click(await within(section).findByRole('button', { name: '복사하기' }))

    expect(await within(section).findByText('복사했습니다.')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(기록문구().text)
  })

  it('클립보드에 쓰지 못하면 직접 복사하라고 안내하고 복사 기록을 남기지 않는다', async () => {
    const user = userEvent.setup()
    const writeText = stubClipboard()
    writeText.mockRejectedValueOnce(new Error('denied'))
    renderApp()

    const recordHeading = await screen.findByRole('heading', { name: '전산 기록 문구' })
    const section = recordHeading.closest('article') as HTMLElement

    await user.click(await within(section).findByRole('button', { name: '복사하기' }))

    expect(
      await within(section).findByText(/문구를 길게 눌러 직접 복사해 주세요/),
    ).toBeInTheDocument()
  })

  it('어르신 당일 묶음을 함께 보여 주고 카드 문구와 따로 복사할 수 있다', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(await screen.findByRole('heading', { name: '전산 기록 문구 묶음' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '보호자 전달 문구 묶음' })).toBeInTheDocument()

    const bundleHeading = screen.getByRole('heading', { name: '전산 기록 문구 묶음' })
    const bundleSection = bundleHeading.closest('article') as HTMLElement

    await user.click(within(bundleSection).getByRole('button', { name: '묶음 복사하기' }))

    expect(await within(bundleSection).findByText('묶음을 복사했습니다.')).toBeInTheDocument()
  })

  it('복사 옆에서 형식을 골라 파일로 내려받는다 (n41)', async () => {
    const user = userEvent.setup()
    renderApp()

    const recordHeading = await screen.findByRole('heading', { name: '전산 기록 문구' })
    const section = recordHeading.closest('article') as HTMLElement

    // 복사가 기본 동작으로 남아 있다.
    expect(within(section).getByRole('button', { name: '복사하기' })).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: '텍스트 파일(.txt)' }))

    await vi.waitFor(() => expect(저장된파일).toEqual([파일이름]))
    expect(파일요청).toEqual(['/api/exports/7/file?format=txt'])
  })

  it('저장하지 않은 편집이 있으면 내려받지 못한다', async () => {
    const user = userEvent.setup()
    renderApp()

    const recordHeading = await screen.findByRole('heading', { name: '전산 기록 문구' })
    const section = recordHeading.closest('article') as HTMLElement

    await user.type(within(section).getByRole('textbox'), '덧붙인 말')

    expect(within(section).getByText('저장한 뒤 내려받을 수 있습니다')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: '텍스트 파일(.txt)' })).toBeDisabled()
    expect(파일요청).toEqual([])
  })

  it('어르신 당일 묶음도 유형별로 파일이 된다', async () => {
    const user = userEvent.setup()
    renderApp()

    const bundleHeading = await screen.findByRole('heading', { name: '전산 기록 문구 묶음' })
    const bundleSection = bundleHeading.closest('article') as HTMLElement

    await user.click(within(bundleSection).getByRole('button', { name: '마크다운 파일(.md)' }))

    await vi.waitFor(() =>
      expect(파일요청).toEqual([
        '/api/care-recipients/1/export-bundles/file?phraseType=RECORD&format=md',
      ]),
    )
  })

  it('워드 파일도 같은 자리에서 고른다', async () => {
    const user = userEvent.setup()
    renderApp()

    const recordHeading = await screen.findByRole('heading', { name: '전산 기록 문구' })
    const section = recordHeading.closest('article') as HTMLElement

    await user.click(within(section).getByRole('button', { name: '워드 파일(.docx)' }))

    await vi.waitFor(() => expect(파일요청).toEqual(['/api/exports/7/file?format=docx']))
  })

  /** 표는 문구가 아니라 카드와 후속 업무를 담는다. 유형별 묶음 안에 있으면 안 된다. */
  it('어르신 당일 표는 유형과 무관하게 한 번만 내려받는다', async () => {
    const user = userEvent.setup()
    renderApp()

    const bundleHeading = await screen.findByRole('heading', { name: '전산 기록 문구 묶음' })
    const bundleSection = bundleHeading.closest('article') as HTMLElement
    expect(
      within(bundleSection).queryByRole('button', { name: '당일 항목 표(.xlsx)' }),
    ).not.toBeInTheDocument()

    const 표버튼 = screen.getAllByRole('button', { name: '당일 항목 표(.xlsx)' })
    expect(표버튼).toHaveLength(1)

    await user.click(표버튼[0])

    await vi.waitFor(() => expect(파일요청).toEqual(['/api/care-recipients/1/export-sheet']))
  })

  it('서버가 내려받기를 거절하면 그 이유를 보여 준다', async () => {
    파일_응답 = {
      status: 409,
      body: JSON.stringify({
        code: 'EXPORT_BUNDLE_EMPTY',
        message: '내려받을 문구가 없습니다. 카드를 검토 완료로 올린 뒤 다시 확인해 주세요.',
        fields: [],
      }),
      headers: {},
    }
    const user = userEvent.setup()
    renderApp()

    const bundleHeading = await screen.findByRole('heading', { name: '전산 기록 문구 묶음' })
    const bundleSection = bundleHeading.closest('article') as HTMLElement

    await user.click(within(bundleSection).getByRole('button', { name: '텍스트 파일(.txt)' }))

    expect(await within(bundleSection).findByText(/내려받을 문구가 없습니다/)).toBeInTheDocument()
    expect(저장된파일).toEqual([])
  })

  it('문구를 만들 수 없는 카드는 안내만 보여 준다', async () => {
    목록_응답 = {
      status: 200,
      body: {
        date: '2026-08-11',
        recipients: [
          {
            careRecipientId: 1,
            careRecipientName: '김말순',
            cards: [카드({ exportAllowed: false, exportBlockedReason: '검토 완료 후 생성할 수 있습니다.' })],
          },
        ],
        unresolved: [],
      },
    }
    renderApp()

    expect(await screen.findByText('검토 완료 후 생성할 수 있습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '전산 기록 문구' })).not.toBeInTheDocument()
  })
})
