import { beforeEach, describe, expect, it } from 'vitest'
import type { HandoverCreateRequest } from './handoverApi'
import { enqueue, loadQueue, queueSize, removeFromQueue } from './offlineQueue'

function 요청(patch: Partial<HandoverCreateRequest> = {}): HandoverCreateRequest {
  return {
    careRecipientId: 1,
    rawText: '점심을 거의 안 드셨어요.',
    inputMethod: 'TEXT',
    occurredAt: '2026-08-12T13:10:00',
    reporterName: '김하늘',
    proxyInput: false,
    ...patch,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('대기열', () => {
  it('처음엔 비어 있다', () => {
    expect(loadQueue()).toEqual([])
    expect(queueSize()).toBe(0)
  })

  it('넣으면 조회된다', () => {
    enqueue(요청())

    expect(queueSize()).toBe(1)
    expect(loadQueue()[0].request).toMatchObject({ rawText: '점심을 거의 안 드셨어요.' })
  })

  it('여러 건을 순서대로 쌓는다', () => {
    enqueue(요청({ rawText: '첫 번째' }))
    enqueue(요청({ rawText: '두 번째' }))

    const queue = loadQueue()
    expect(queue).toHaveLength(2)
    expect(queue[0].request.rawText).toBe('첫 번째')
    expect(queue[1].request.rawText).toBe('두 번째')
  })

  it('보낸 항목만 지운다', () => {
    const 첫번째 = enqueue(요청({ rawText: '첫 번째' }))
    enqueue(요청({ rawText: '두 번째' }))

    removeFromQueue(첫번째.id)

    const queue = loadQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].request.rawText).toBe('두 번째')
  })

  it('새로고침해도 남아 있다 — localStorage 에 저장한다', () => {
    enqueue(요청())

    // 모듈을 다시 부르지 않고, 저장된 raw 값을 직접 읽어 실제로 브라우저 저장소에 있는지 본다.
    const raw = window.localStorage.getItem('ieobom.offline-queue.v1')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw ?? '[]')).toHaveLength(1)
  })
})
