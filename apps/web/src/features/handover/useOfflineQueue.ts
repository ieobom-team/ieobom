import { useQuery } from '@tanstack/react-query'
import { loadQueue, OFFLINE_QUEUE_KEY } from './offlineQueue'

/** 재전송을 기다리는 입력이 몇 건인지. 화면이 갈려도(홈 · 입력 화면) 같은 상태를 본다. */
export function useOfflineQueue() {
  return useQuery({ queryKey: OFFLINE_QUEUE_KEY, queryFn: () => loadQueue() })
}
