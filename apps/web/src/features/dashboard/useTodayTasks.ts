import { useQuery } from '@tanstack/react-query'
import { fetchPendingBriefing, fetchTasks } from './dashboardApi'

export const TODAY_TASKS_KEY = ['tasks', 'today'] as const
export const PENDING_BRIEFING_KEY = ['tasks', 'today', 'pending-briefing'] as const

/**
 * 당일 업무. 대시보드의 미처리·완료 두 영역이 이 하나를 나눠 쓴다.
 *
 * 인계 카드는 여기 없다. 대시보드는 인계(`useHandoverCards`)와 업무를 **따로** 불러서 한쪽이 실패해도
 * 성공한 쪽을 그대로 보여 준다. (Manyfast F-HQTFLK exceptions)
 */
export function useTodayTasks() {
  return useQuery({ queryKey: TODAY_TASKS_KEY, queryFn: () => fetchTasks() })
}

/**
 * 하원 미처리 브리핑.
 *
 * 캐시 키를 대시보드와 나눈다. 같은 키를 쓰면 대시보드에서 받아 둔 응답이 그대로 그려지면서 브리핑
 * 호출이 생략되고, 그러면 서버에 브리핑 확인 기록이 남지 않는다.
 */
export function usePendingBriefing() {
  return useQuery({ queryKey: PENDING_BRIEFING_KEY, queryFn: () => fetchPendingBriefing() })
}
