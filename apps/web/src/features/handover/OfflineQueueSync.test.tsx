import { render, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../shared/api/queryClient'
import { enqueue, loadQueue } from './offlineQueue'
import { OfflineQueueSync } from './OfflineQueueSync'
import type { HandoverCreateRequest } from './handoverApi'

function 요청(): HandoverCreateRequest {
  return {
    careRecipientId: 1,
    rawText: '점심을 거의 안 드셨어요.',
    inputMethod: 'TEXT',
    occurredAt: '2026-08-12T13:10:00',
    reporterName: '김하늘',
    proxyInput: false,
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderSync() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <OfflineQueueSync />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('마운트 시 재전송', () => {
  it('대기 중인 입력을 다시 보내고 성공하면 큐에서 지운다', async () => {
    enqueue(요청())
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/api/handovers') && !input.includes('/cards')) {
          return Promise.resolve(
            json(
              {
                id: 12,
                careRecipientId: 1,
                careRecipientName: '김말순',
                rawText: '점심을 거의 안 드셨어요.',
                inputMethod: 'TEXT',
                occurredAt: '2026-08-12T13:10:00',
                reporterName: '김하늘',
                proxyInput: false,
                infoSource: null,
                createdAt: '2026-08-12T13:11:00',
              },
              201,
            ),
          )
        }
        // 정리(구조화)는 이 테스트의 관심사가 아니다. 실패해도 재전송 판정에 영향 없다.
        return Promise.resolve(json({ code: 'LLM_UNAVAILABLE', message: '', fields: [] }, 503))
      }),
    )

    renderSync()

    await waitFor(() => expect(loadQueue()).toHaveLength(0))
  })

  it('아직 연결이 안 됐으면 큐에 그대로 둔다', async () => {
    enqueue(요청())
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )

    renderSync()

    await waitFor(() => expect(vi.mocked(window.fetch)).toHaveBeenCalled())
    expect(loadQueue()).toHaveLength(1)
  })
})

describe('동시 실행 방지', () => {
  it('첫 시도가 끝나기 전에 또 트리거돼도 같은 항목을 두 번 보내지 않는다', async () => {
    // React StrictMode는 마운트 effect를 한 번 더 부른다 — 첫 호출의 fetch가 끝나기 전에
    // 두 번째 호출이 같은 대기 항목을 집으면 서버에 같은 인계가 두 번 생긴다.
    enqueue(요청())
    let 호출_수 = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/api/handovers') && !input.includes('/cards')) {
          호출_수 += 1
          return Promise.resolve(
            json(
              {
                id: 12,
                careRecipientId: 1,
                careRecipientName: '김말순',
                rawText: '점심을 거의 안 드셨어요.',
                inputMethod: 'TEXT',
                occurredAt: '2026-08-12T13:10:00',
                reporterName: '김하늘',
                proxyInput: false,
                infoSource: null,
                createdAt: '2026-08-12T13:11:00',
              },
              201,
            ),
          )
        }
        return Promise.resolve(json({ code: 'LLM_UNAVAILABLE', message: '', fields: [] }, 503))
      }),
    )

    renderSync()
    // 마운트 직후, 첫 fetch 가 끝나기 전(아직 await 전)에 곧바로 한 번 더 트리거한다.
    window.dispatchEvent(new Event('online'))

    await waitFor(() => expect(loadQueue()).toHaveLength(0))
    expect(호출_수).toBe(1)
  })
})

describe('online 이벤트', () => {
  it('연결이 회복되면 다시 시도한다', async () => {
    enqueue(요청())
    let 첫_시도 = true
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.includes('/api/handovers') && !input.includes('/cards')) {
          if (첫_시도) {
            첫_시도 = false
            return Promise.reject(new TypeError('Failed to fetch'))
          }
          return Promise.resolve(
            json(
              {
                id: 12,
                careRecipientId: 1,
                careRecipientName: '김말순',
                rawText: '점심을 거의 안 드셨어요.',
                inputMethod: 'TEXT',
                occurredAt: '2026-08-12T13:10:00',
                reporterName: '김하늘',
                proxyInput: false,
                infoSource: null,
                createdAt: '2026-08-12T13:11:00',
              },
              201,
            ),
          )
        }
        return Promise.resolve(json({ code: 'LLM_UNAVAILABLE', message: '', fields: [] }, 503))
      }),
    )

    renderSync()
    await waitFor(() => expect(loadQueue()).toHaveLength(1))

    window.dispatchEvent(new Event('online'))

    await waitFor(() => expect(loadQueue()).toHaveLength(0))
  })
})
