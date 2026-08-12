import type { HandoverCreateRequest } from './handoverApi'

/**
 * 저장 중 네트워크가 끊겼을 때 기기에 남겨 두는 대기열. (Manyfast F-YJJJUX exceptions)
 *
 * **재입력을 요구하지 않는다** — 그래서 재시도 횟수 제한도, 보관 기간도 두지 않는다.
 * 포기하거나 지우면 곧 "다시 입력해 주세요"와 같은 결과가 된다. 성공해야만 지운다.
 * (이슈 #9의 미결 질문 — 임의로 숫자를 정하는 대신 그 결정 자체가 필요 없는 쪽을 골랐다)
 */

export const STORAGE_KEY = 'ieobom.offline-queue.v1'

/** 대기열을 읽는 화면들이 같이 쓰는 캐시 키. 큐가 바뀌면 이 키를 무효화한다. */
export const OFFLINE_QUEUE_KEY = ['offline-queue'] as const

export type QueuedHandover = {
  /** 대기열 안에서만 쓰는 로컬 식별자. 서버 id 가 아니다 */
  id: string
  request: HandoverCreateRequest
  queuedAt: string
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeRaw(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // 저장 공간이 없거나 사생활 보호 모드라도 화면 흐름은 막지 않는다.
    // 이 경우 재전송은 이번 세션 메모리에 남은 큐로만 동작한다.
  }
}

function isQueuedHandover(value: unknown): value is QueuedHandover {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as QueuedHandover).id === 'string' &&
    typeof (value as QueuedHandover).queuedAt === 'string' &&
    typeof (value as QueuedHandover).request === 'object'
  )
}

export function loadQueue(): QueuedHandover[] {
  const raw = readRaw()
  if (raw === null) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isQueuedHandover) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedHandover[]): void {
  writeRaw(JSON.stringify(queue))
}

/** 저장에 실패한 입력을 대기열 맨 뒤에 추가한다. */
export function enqueue(request: HandoverCreateRequest): QueuedHandover {
  const entry: QueuedHandover = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    request,
    queuedAt: new Date().toISOString(),
  }
  saveQueue([...loadQueue(), entry])
  return entry
}

/** 재전송에 성공한 항목만 대기열에서 지운다. */
export function removeFromQueue(id: string): void {
  saveQueue(loadQueue().filter((entry) => entry.id !== id))
}

export function queueSize(): number {
  return loadQueue().length
}
