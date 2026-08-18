import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../shared/api/queryClient'
import { AppRoutes } from '../../routes/AppRoutes'
import { SessionProvider } from '../session/SessionProvider'
import { saveSession } from '../session/sessionStorage'
import { seedStaffCache, TEST_STAFF } from '../session/staffFixture'
import type { HandoverCreateRequest } from './handoverApi'

const 김하늘 = TEST_STAFF[0]

const 어르신들 = [
  { id: 6, name: '강복순', code: 'IB-006' },
  { id: 1, name: '김말순', code: 'IB-001' },
  { id: 2, name: '박순자', code: 'IB-002' },
]

type PostOutcome = { status: number; body: unknown }

let 저장_응답: PostOutcome
let 목록_응답: PostOutcome
let 구조화_응답: PostOutcome
/** 서버 음성 인식 응답. (#147) */
let 전사_응답: PostOutcome
let 보낸_요청: HandoverCreateRequest[]
/** 구조화를 요청한 인계 id. LLM 은 서버 뒤에 있으므로 여기서는 호출만 본다. */
let 구조화_호출: number[]
/** 전사에 올라간 음성 Data URL. 원본 음성이 그대로 올라갔는지 본다. */
let 전사_호출: string[]
/** 저장 호출 자체가 연결 실패로 끝나야 하는 테스트에서 켠다. (#9) */
let 네트워크_끊김: boolean

function json({ status, body }: PostOutcome) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  보낸_요청 = []
  구조화_호출 = []
  전사_호출 = []
  전사_응답 = { status: 200, body: { text: '점심을 거의 안 드셨어요.' } }
  네트워크_끊김 = false
  목록_응답 = { status: 200, body: { careRecipients: 어르신들 } }
  구조화_응답 = {
    status: 201,
    body: { handoverId: 12, createdCount: 2, discardedCount: 1, cards: [] },
  }
  저장_응답 = {
    status: 201,
    body: {
      id: 12,
      careRecipientId: 1,
      careRecipientName: '김말순',
      rawText: '점심 드시고 나서 오른쪽 다리를 계속 주무르셨어요.',
      inputMethod: 'TEXT',
      occurredAt: '2026-08-11T13:10:00',
      reporterName: 김하늘.name,
      proxyInput: false,
      infoSource: null,
      createdAt: '2026-08-11T13:11:04.512',
    },
  }

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      if (input.includes('/api/care-recipients')) {
        return Promise.resolve(json(목록_응답))
      }
      // 정리 결과에서 목록 화면으로 넘어가는 경로만 본다. 목록 화면 자체는 #11 테스트가 본다.
      if (input.includes('/api/handover-cards')) {
        return Promise.resolve(
          json({ status: 200, body: { date: '2026-08-11', recipients: [], unresolved: [] } }),
        )
      }
      // 전사와 `/api/handovers/{id}/cards` 는 저장 경로보다 먼저 걸려야 한다.
      if (input.includes('/api/handovers/transcribe')) {
        전사_호출.push((JSON.parse(String(init?.body)) as { audioData: string }).audioData)
        return Promise.resolve(json(전사_응답))
      }
      const 구조화 = /\/api\/handovers\/(\d+)\/cards$/.exec(input)
      if (구조화 !== null) {
        구조화_호출.push(Number(구조화[1]))
        return Promise.resolve(json(구조화_응답))
      }
      if (input.includes('/api/handovers')) {
        if (네트워크_끊김) {
          return Promise.reject(new TypeError('Failed to fetch'))
        }
        보낸_요청.push(JSON.parse(String(init?.body)) as HandoverCreateRequest)
        return Promise.resolve(json(저장_응답))
      }
      throw new Error(`테스트가 예상하지 못한 호출입니다: ${input}`)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderApp(initialPath = '/field/handovers/new') {
  // 입력자 이름은 저장된 사번을 받아 둔 명단에서 다시 찾아 만든다. (#33)
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

/**
 * #135 부터 관찰 구분(직접 관찰)·입력 방식(음성 미지원 기기는 텍스트)은 이미 기본값이 채워진
 * 채로 뜬다. 텍스트 내용만 채우면 저장할 수 있는 상태가 된다.
 */
async function 텍스트로_내용_채우기(user: ReturnType<typeof userEvent.setup>, 내용: string) {
  await user.type(screen.getByLabelText(/보신 그대로/), 내용)
}

async function 추가_설정_펼치기(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /추가 설정/ }))
}

describe('현장 홈에서 들어오기', () => {
  it('특이사항 남기기를 누르면 입력 화면이 열린다', async () => {
    const user = userEvent.setup()
    renderApp('/field')

    await user.click(screen.getByRole('button', { name: /특이사항 남기기/ }))

    expect(screen.getByRole('heading', { name: '어느 어르신이신가요?' })).toBeInTheDocument()
  })
})

describe('입력 방식 선택 — 한 화면 안에서 바로 고른다', () => {
  it('세 가지 방식이 모두 보이고 고를 수 있다', async () => {
    renderApp()

    expect(screen.getByRole('button', { name: /텍스트로 쓰기/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /말로 남기기/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /체크로 고르기/ })).toBeEnabled()
  })

  it('녹음할 수 없는 기기는 텍스트 입력이 기본값이다', async () => {
    renderApp()

    expect(screen.getByLabelText(/보신 그대로/)).toBeInTheDocument()
  })
})

describe('화면 순서 — 입력 방식이 어르신 선택보다 먼저 온다 (#141, #135의 순서 반전)', () => {
  it('"어떻게 남기시겠어요?"가 "어느 어르신이신가요?"보다 먼저 나온다', async () => {
    renderApp()

    const 제목들 = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    const 방식_위치 = 제목들.findIndex((text) => text?.includes('어떻게 남기시겠어요'))
    const 어르신_위치 = 제목들.findIndex((text) => text?.includes('어느 어르신이신가요'))

    expect(방식_위치).toBeGreaterThanOrEqual(0)
    expect(어르신_위치).toBeGreaterThan(방식_위치)
  })
})

describe('원문 기반 어르신 자동 매칭 (#141, Manyfast F-YJJJUX v46)', () => {
  it('원문에 어르신 이름이 정확히 1명 포함되면 칩을 누르지 않아도 그 어르신으로 저장된다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '김말순 어르신이 점심을 거의 안 드셨어요.')

    const 김말순_칩 = await screen.findByRole('button', { name: /김말순/ })
    expect(김말순_칩).toHaveClass('border-primary')

    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0].careRecipientId).toBe(1)
  })

  it('이름이 없거나 여러 명과 겹치면 자동으로 채우지 않고 기존 검증이 그대로 뜬다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '김말순 님과 박순자 님이 함께 산책하셨어요.')
    await screen.findByRole('button', { name: /박순자/ })
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('대상 어르신')
    expect(보낸_요청).toHaveLength(0)
  })

  it('자동으로 채워진 뒤에도 사용자가 다른 어르신을 직접 고르면 그 선택이 유지된다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '김말순 어르신이 점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /박순자/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0].careRecipientId).toBe(2)
  })

  it('성을 빼고 이름만 말해도 유일하면 자동 선택되고, 목록 밖 배너에도 이름이 뜬다 (#142)', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '말순 언니가 오늘 컨디션이 좋아 보이셨어요.')

    expect(await screen.findByText(/선택됨: 김말순 어르신/)).toBeInTheDocument()
    const 김말순_칩 = screen.getByRole('button', { name: /김말순/ })
    expect(김말순_칩).toHaveClass('border-primary')

    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0].careRecipientId).toBe(1)
  })

  it('배너의 선택 해제를 누르면 선택이 풀리고, 다시 저장하려면 직접 골라야 한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '김말순 어르신이 점심을 거의 안 드셨어요.')
    await screen.findByText(/선택됨: 김말순 어르신/)

    await user.click(screen.getByRole('button', { name: '선택 해제' }))

    expect(screen.queryByText(/선택됨:/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '저장하기' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('대상 어르신')
    expect(보낸_요청).toHaveLength(0)
  })
})

describe('추가 설정 — 관찰 구분·정보 출처 (§2.3 인라인 확장, §2.4 스마트 기본값)', () => {
  it('기본값은 직접 관찰이며 접힌 채로도 값이 보인다', async () => {
    renderApp()

    expect(screen.getByRole('button', { name: /추가 설정.*직접 관찰/ })).toBeInTheDocument()
  })

  it('펼치면 직접 관찰이 이미 선택돼 있고 정보 출처는 묻지 않는다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 추가_설정_펼치기(user)

    expect(screen.getByRole('button', { name: '제가 직접 봤어요' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByRole('heading', { name: /어느 분께 들으셨나요/ })).not.toBeInTheDocument()
  })

  it('다른 분께 들었다고 바꾸면 정보 출처를 고르는 항목이 인라인으로 나온다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 추가_설정_펼치기(user)
    await user.click(screen.getByRole('button', { name: '다른 분께 들었어요' }))

    expect(screen.getByRole('heading', { name: /어느 분께 들으셨나요/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '보호자' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '운전원' })).toBeInTheDocument()
  })

  it('입력자와 정보 출처를 갈라서 보낸다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 추가_설정_펼치기(user)
    await user.click(screen.getByRole('button', { name: '다른 분께 들었어요' }))
    await user.click(screen.getByRole('button', { name: '보호자' }))
    await 텍스트로_내용_채우기(user, '밤사이 잠을 못 주무셨대요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0].reporterName).toBe(김하늘.name)
    expect(보낸_요청[0].proxyInput).toBe(true)
    expect(보낸_요청[0].infoSource).toBe('GUARDIAN')
  })
})

describe('텍스트 입력으로 등록', () => {
  it('어르신과 입력 시점을 함께 담아 등록한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심 드시고 나서 오른쪽 다리를 계속 주무르셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청).toHaveLength(1)
    expect(보낸_요청[0]).toMatchObject({
      careRecipientId: 1,
      rawText: '점심 드시고 나서 오른쪽 다리를 계속 주무르셨어요.',
      inputMethod: 'TEXT',
      proxyInput: false,
    })
    // 입력 시점은 화면을 연 시각이 채워져 있고, 계약대로 오프셋 없는 지역 시각이다.
    expect(보낸_요청[0].occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  })

  it('저장에 성공하면 다음 정리 단계로 넘어갔음을 알린다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '오후 내내 기침을 하셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('heading', { name: '제출 완료' })).toBeInTheDocument()
    expect(await screen.findByText(/인계 카드 2건으로 정리했습니다/)).toBeInTheDocument()
    expect(screen.getByText(/김말순 어르신/)).toBeInTheDocument()
  })
})

describe('저장 중 연결 끊김 — 임시 저장과 자동 재전송 (#9)', () => {
  it('연결이 안 되면 실패로 끝내지 않고 기기에 임시 저장했다고 안내한다', async () => {
    네트워크_끊김 = true
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('heading', { name: '임시 저장 완료' })).toBeInTheDocument()
    expect(screen.getByText(/다시 입력하지 않으셔도 됩니다/)).toBeInTheDocument()
    // 실패로 끝나지 않았으므로 재입력을 요구하는 오류 화면(보완할 항목)은 뜨지 않는다.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // 서버에는 실제로 닿지 않았다.
    expect(보낸_요청).toHaveLength(0)
  })

  it('안내 카드에 저장 시간·어르신·입력 방식을 보여준다', async () => {
    네트워크_끊김 = true
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '임시 저장 완료' })
    expect(screen.getByText('저장 시간')).toBeInTheDocument()
    expect(screen.getByText(/^김말순/)).toBeInTheDocument()
    expect(screen.getByText('텍스트로 쓰기')).toBeInTheDocument()
  })

  it('현장 홈으로 돌아가면 대기 중인 건수가 보인다', async () => {
    네트워크_끊김 = true
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))
    await screen.findByRole('heading', { name: '임시 저장 완료' })

    await user.click(screen.getByRole('button', { name: '현장 홈으로' }))

    expect(await screen.findByText(/연결을 기다리는 인계 1건/)).toBeInTheDocument()
  })

  it('연결이 회복되면 다시 저장하지 않아도 자동으로 전송된다', async () => {
    네트워크_끊김 = true
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))
    await screen.findByRole('heading', { name: '임시 저장 완료' })

    네트워크_끊김 = false
    window.dispatchEvent(new Event('online'))

    await waitFor(() => expect(보낸_요청).toHaveLength(1))
    expect(보낸_요청[0].rawText).toBe('점심을 거의 안 드셨어요.')
  })
})

/**
 * 음성 입력. **기기는 녹음만 하고 서버가 글로 바꾼다.** (#147 · Manyfast F-YJJJUX rules v49)
 *
 * 브라우저 내장 인식을 쓰던 시절의 테스트(실시간 타이핑 · 인식 오류 이벤트)는 그 코드와 함께
 * 사라졌다. 여기서 지키는 것은 **글이 멈춘 뒤 한 번에 나타난다**, **변환이 실패해도 원본 음성과
 * 글 칸은 남는다**, **상시 녹음이 되지 않는다** 세 가지다.
 */
describe('음성 입력으로 등록', () => {
  class 가짜_녹음기 {
    static instances: 가짜_녹음기[] = []
    state: 'inactive' | 'recording' = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null

    constructor() {
      가짜_녹음기.instances.push(this)
    }

    start() {
      this.state = 'recording'
    }

    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob([new Uint8Array(8)], { type: this.mimeType }) })
      this.onstop?.()
    }
  }

  let 마이크_해제: ReturnType<typeof vi.fn>

  beforeEach(() => {
    가짜_녹음기.instances = []
    마이크_해제 = vi.fn()
    vi.stubGlobal('MediaRecorder', 가짜_녹음기)
    // navigator 를 통째로 바꾸면 userEvent 가 쓰는 것들까지 사라진다. 필요한 것만 얹는다.
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: 마이크_해제 }] }),
      },
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaDevices')
  })

  /** 마이크를 눌러 말하고 다시 눌러 멈추는 것까지. 글은 그 뒤 변환이 끝나야 나타난다. */
  async function 녹음하고_멈추기(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /말로 남기기/ }))
    await user.click(screen.getByRole('button', { name: /눌러서 말하기/ }))
    await waitFor(() => expect(가짜_녹음기.instances).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: /눌러서 멈추기/ }))
  }

  it('멈추면 서버가 돌려준 글이 나타나고, 원본 음성과 함께 음성 방식으로 저장된다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 녹음하고_멈추기(user)

    const textarea = await screen.findByLabelText(/말씀하신 내용/)
    await waitFor(() => expect(textarea).toHaveValue('점심을 거의 안 드셨어요.'))
    expect(전사_호출[0]).toMatch(/^data:audio\/webm;base64,/)

    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0]).toMatchObject({
      inputMethod: 'VOICE',
      rawText: '점심을 거의 안 드셨어요.',
    })
    // 원본 음성이 함께 저장돼야 카드에서 다시 들을 수 있다. (Manyfast R-ONESTC 수락기준)
    expect(보낸_요청[0].audioData).toMatch(/^data:audio\/webm;base64,/)
  })

  /** 말하는 중에는 채워지지 않는다. 예전 실시간 타이핑을 되살리지 않았는지 본다. */
  it('말하는 중에는 글이 채워지지 않는다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /말로 남기기/ }))
    await user.click(screen.getByRole('button', { name: /눌러서 말하기/ }))
    await waitFor(() => expect(가짜_녹음기.instances).toHaveLength(1))

    expect(screen.getByLabelText(/말씀하신 내용/)).toHaveValue('')
    expect(전사_호출).toHaveLength(0)
  })

  /** 자동 채움 대조는 서버가 돌려준 글을 기준으로 한다. (Manyfast F-YJJJUX rules v49) */
  it('서버가 돌려준 글로 대상 어르신이 자동으로 채워진다', async () => {
    전사_응답 = { status: 200, body: { text: '김말순 어르신이 점심을 거의 안 드셨어요.' } }
    const user = userEvent.setup()
    renderApp()

    await 녹음하고_멈추기(user)
    await waitFor(() =>
      expect(screen.getByLabelText(/말씀하신 내용/)).toHaveValue(
        '김말순 어르신이 점심을 거의 안 드셨어요.',
      ),
    )

    // 칩을 누르지 않고 그대로 저장한다 — 자동으로 채워져 있어야 통과한다.
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0]).toMatchObject({ careRecipientId: 1, inputMethod: 'VOICE' })
  })

  /**
   * 변환이 실패해도 녹음된 원본 음성과 글 칸은 남아 있다. (Manyfast F-YJJJUX rules v49)
   *
   * 음성을 draft 에 붙이는 것이 변환보다 먼저라 지켜진다. 순서가 뒤집히면 여기서 걸린다.
   */
  it('변환이 실패해도 원본 음성은 저장되고 글은 직접 적어 마칠 수 있다', async () => {
    전사_응답 = { status: 503, body: { code: 'LLM_UNAVAILABLE', message: '변환할 수 없습니다.' } }
    const user = userEvent.setup()
    renderApp()

    await 녹음하고_멈추기(user)

    expect(await screen.findByText(/글로 바꾸지 못했습니다/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/말씀하신 내용/), '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0]).toMatchObject({
      inputMethod: 'VOICE',
      rawText: '점심을 거의 안 드셨어요.',
    })
    expect(보낸_요청[0].audioData).toMatch(/^data:audio\/webm;base64,/)
  })

  it('아무 말도 담기지 않았으면 직접 적으라고 안내한다', async () => {
    전사_응답 = { status: 200, body: { text: '' } }
    const user = userEvent.setup()
    renderApp()

    await 녹음하고_멈추기(user)

    expect(await screen.findByText(/아무 말도 들리지 않았습니다/)).toBeInTheDocument()
  })

  it('화면을 벗어나면(뒤로가기) 마이크를 놓는다 — 상시 녹음 금지', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /말로 남기기/ }))
    await user.click(screen.getByRole('button', { name: /눌러서 말하기/ }))
    await waitFor(() => expect(가짜_녹음기.instances).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: '이전' }))

    expect(가짜_녹음기.instances[0].state).toBe('inactive')
    await waitFor(() => expect(마이크_해제).toHaveBeenCalled())
  })

  it('다른 입력 방식으로 바꾸면(같은 화면 안에서도) 녹음을 멈춘다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /말로 남기기/ }))
    await user.click(screen.getByRole('button', { name: /눌러서 말하기/ }))
    await waitFor(() => expect(가짜_녹음기.instances).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: /텍스트로 쓰기/ }))

    expect(가짜_녹음기.instances[0].state).toBe('inactive')
    await waitFor(() => expect(마이크_해제).toHaveBeenCalled())
  })

  it('녹음 중에 저장을 누르면 멈추고 변환이 끝난 뒤 이어서 저장한다', async () => {
    전사_응답 = { status: 200, body: { text: '김말순 어르신이 점심을 거의 안 드셨어요.' } }
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /말로 남기기/ }))
    await user.click(screen.getByRole('button', { name: /눌러서 말하기/ }))
    await waitFor(() => expect(가짜_녹음기.instances).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    // 저장이 변환을 앞지르면 글이 빈 채로 나간다.
    expect(보낸_요청[0]).toMatchObject({
      inputMethod: 'VOICE',
      rawText: '김말순 어르신이 점심을 거의 안 드셨어요.',
    })
  })

  it('마이크 권한이 없으면 안내하고 다시 누를 수 있는 상태로 둔다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new Error('NotAllowedError')) },
    })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /말로 남기기/ }))
    await user.click(screen.getByRole('button', { name: /눌러서 말하기/ }))

    expect(await screen.findByText(/마이크 권한/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /눌러서 말하기/ })).toBeInTheDocument()
    expect(전사_호출).toHaveLength(0)
  })
})

describe('체크 입력으로 등록', () => {
  it('고른 항목이 문장으로 합쳐져 체크 방식으로 저장된다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /체크로 고르기/ }))
    await user.click(screen.getByRole('checkbox', { name: /낙상 위험 행동 관찰/ }))
    await user.click(screen.getByRole('checkbox', { name: /투약 거부 또는 누락/ }))
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0]).toMatchObject({
      inputMethod: 'CHECK',
      rawText: '체크 항목: 낙상 위험 행동 관찰, 투약 거부 또는 누락',
    })
  })

  it('고른 순서와 상관없이 화면에 보이는 순서로 문장을 만든다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /체크로 고르기/ }))
    await user.click(screen.getByRole('checkbox', { name: /투약 거부 또는 누락/ }))
    await user.click(screen.getByRole('checkbox', { name: /낙상 위험 행동 관찰/ }))
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    expect(보낸_요청[0].rawText).toBe('체크 항목: 낙상 위험 행동 관찰, 투약 거부 또는 누락')
  })

  it('아무것도 고르지 않고 저장하면 하나 이상 고르라고 안내한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /체크로 고르기/ }))
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('하나 이상 선택')
    expect(보낸_요청).toHaveLength(0)
  })
})

describe('음성 인식 미지원 브라우저', () => {
  it('말로 남기기를 눌러도 화면을 옮기지 않고 텍스트로 남기라고 안내한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /말로 남기기/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('텍스트로 남겨')
    expect(screen.getByRole('heading', { name: /어떻게 남기시겠어요/ })).toBeInTheDocument()
  })
})

/**
 * 저장 뒤 구조화 호출. LLM 은 서버 뒤에 있어 여기서는 호출과 안내만 본다.
 * 실제 스키마 강제와 근거 대조는 백엔드 테스트와 `./gradlew llmLiveTest` 가 본다.
 */
describe('인계 카드 정리로 넘기기', () => {
  it('저장한 인계 하나에 대해 구조화를 한 번만 부른다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByText(/인계 카드 2건으로 정리했습니다/)
    expect(구조화_호출).toEqual([12])
  })

  it('근거를 찾지 못해 빠진 항목이 있으면 그 사실을 감추지 않는다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByText(/1건은 카드로 만들지 않았습니다/)).toBeInTheDocument()
  })

  it('정리가 실패해도 저장됐다는 사실은 그대로 알린다', async () => {
    구조화_응답 = {
      status: 503,
      body: { code: 'LLM_UNAVAILABLE', message: '정리에 실패했습니다.', fields: [] },
    }
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('heading', { name: '제출 완료' })).toBeInTheDocument()
    expect(await screen.findByText(/다시 쓰지 않으셔도 됩니다/)).toBeInTheDocument()
  })

  it('입력 시간·입력자를 보여 주고, 확인을 누르면 현장 홈으로 이동한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '점심을 거의 안 드셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    const notice = screen.getByRole('status')
    expect(within(notice).getByText('입력자')).toBeInTheDocument()
    expect(within(notice).getByText(김하늘.name)).toBeInTheDocument()
    expect(within(notice).getByText('입력 시간')).toBeInTheDocument()
    // #90 — "인계 카드 보기" 버튼은 없앤다. "하나 더 남기기"(보조)/"확인"(주요) 2개만 남는다.
    expect(screen.queryByRole('button', { name: '인계 카드 보기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '하나 더 남기기' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '확인' }))

    expect(await screen.findByRole('heading', { name: '오늘 특이사항' })).toBeInTheDocument()
  })
})

describe('기기별 마지막 사용 입력 방식 기억 (#135)', () => {
  it('체크 방식으로 저장에 성공하면, 하나 더 남기기에서는 체크가 기본값이 된다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /체크로 고르기/ }))
    await user.click(screen.getByRole('checkbox', { name: /낙상 위험 행동 관찰/ }))
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    await screen.findByRole('heading', { name: '제출 완료' })
    await user.click(screen.getByRole('button', { name: '하나 더 남기기' }))

    // 다시 체크로 고르기를 누르지 않아도 체크리스트가 바로 보인다.
    expect(screen.getByRole('checkbox', { name: /낙상 위험 행동 관찰/ })).toBeInTheDocument()
  })
})

describe('보완할 항목 안내', () => {
  it('필수 항목을 비운 채 저장하면 무엇을 채워야 하는지 한 번에 알려 준다', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: '저장하기' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('입력 내용')
    expect(alert).toHaveTextContent('대상 어르신')
  })

  it('어르신을 고르지 않고 저장하면 저장하지 않고 안내한다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '오후 내내 기침을 하셨어요.')
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('대상 어르신')
    expect(보낸_요청).toHaveLength(0)
  })

  it('서버가 돌려준 보완 항목을 그대로 모아서 보여 준다', async () => {
    저장_응답 = {
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        message: '보완할 항목이 있습니다.',
        fields: [
          { field: 'occurredAt', reason: '입력 시점을 입력해 주세요.' },
          { field: 'rawText', reason: '입력 내용을 남겨 주세요.' },
        ],
      },
    }
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '오후 내내 기침을 하셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('입력 시점')
    expect(alert).toHaveTextContent('입력 내용')
    // 입력 시점은 접힌 "추가 설정" 안에 있으므로 안내와 함께 펼쳐져야 고칠 수 있다.
    expect(screen.getByLabelText(/언제 있었던 일인가요/)).toBeInTheDocument()
  })

  it('고른 어르신이 목록에 없으면 다시 고르도록 안내한다', async () => {
    저장_응답 = {
      status: 404,
      body: {
        code: 'CARE_RECIPIENT_NOT_FOUND',
        message: '어르신을 찾을 수 없습니다.',
        fields: [],
      },
    }
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '오후 내내 기침을 하셨어요.')
    await user.click(await screen.findByRole('button', { name: /김말순/ }))
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('목록에서 다시 골라 주세요')
    expect(screen.getByRole('heading', { name: /어느 어르신이신가요/ })).toBeInTheDocument()
  })
})

describe('어르신 목록', () => {
  it('이름으로 좁혀서 찾을 수 있다', async () => {
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '오후 내내 기침을 하셨어요.')
    await screen.findByRole('button', { name: /김말순/ })
    await user.type(screen.getByLabelText(/이름이나 식별번호로 찾기/), '박')

    expect(screen.getByRole('button', { name: /박순자/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /김말순/ })).not.toBeInTheDocument()
  })

  it('목록을 불러오지 못하면 다시 시도할 수 있다', async () => {
    목록_응답 = { status: 500, body: { code: 'UNKNOWN', message: '오류', fields: [] } }
    const user = userEvent.setup()
    renderApp()

    await 텍스트로_내용_채우기(user, '오후 내내 기침을 하셨어요.')

    expect(await screen.findByText(/어르신 목록을 불러오지 못했습니다/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '목록 다시 불러오기' })).toBeInTheDocument()
  })
})
