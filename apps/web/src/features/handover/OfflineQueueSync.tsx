import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { structureHandover } from '../handover-card/handoverCardApi'
import { HANDOVER_CARDS_KEY } from '../handover-card/useHandoverCards'
import { createHandover } from './handoverApi'
import { loadQueue, OFFLINE_QUEUE_KEY, removeFromQueue } from './offlineQueue'

/**
 * 연결이 회복되면 대기열을 자동으로 다시 보낸다. (Manyfast F-YJJJUX exceptions)
 *
 * 화면 어디에 있든 한 번만 떠 있으면 되므로 `AppRoutes`에 한 번 마운트한다. 아무것도
 * 그리지 않는다 — 화면은 `useOfflineQueue`로 대기 상태만 읽는다.
 */
export function OfflineQueueSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const retry = () => {
      void resendQueue(queryClient)
    }

    // 화면을 열자마자 한 번 — 이전 세션에서 못 보낸 게 있을 수 있다.
    retry()
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [queryClient])

  return null
}

/**
 * 동시에 두 번 돌지 않게 막는 잠금.
 *
 * React StrictMode는 개발 모드에서 effect를 마운트 직후 한 번 더 부른다. 잠금이 없으면
 * 두 호출이 같은 대기 항목을 동시에 읽어 서버에 **같은 인계를 두 번** 만든다 — "online"
 * 이벤트가 짧은 간격으로 여러 번 오는 경우도 마찬가지다.
 */
let syncInFlight = false

async function resendQueue(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  if (syncInFlight) {
    return
  }
  syncInFlight = true
  try {
    for (const entry of loadQueue()) {
      try {
        const handover = await createHandover(entry.request)
        removeFromQueue(entry.id)
        queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_KEY })
        // 정리(구조화)는 평소 저장 흐름과 같다 — 실패해도 재전송 자체는 이미 끝난 것으로 본다.
        structureHandover(handover.id)
          .then(() => queryClient.invalidateQueries({ queryKey: HANDOVER_CARDS_KEY }))
          .catch(() => {
            // 정리 실패는 카드 목록 화면에서 다시 시도할 수 있다. 여기서는 재전송만 책임진다.
          })
      } catch {
        // 아직 연결이 안 됐거나 다시 실패했다. 큐에 남겨 두고 다음 online 이벤트를 기다린다.
        return
      }
    }
  } finally {
    syncInFlight = false
  }
}
