import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchNotifications,
  markNotificationRead,
  type NotificationListResponse,
  type NotificationResponse,
} from './notificationApi'

/** 알림 목록 쿼리 키. staffCode 별로 분리한다. */
export const notificationsKey = (staffCode: string) =>
  ['notifications', staffCode] as const

/**
 * 알림 목록을 30초마다 폴링한다. (F-JIEOJO rules)
 *
 * `staffCode` 가 없으면 요청하지 않는다. 세션이 없는 화면에서도 훅이
 * 마운트되지 않도록 호출부에서 조건을 판단하지만, 방어 차원에서 enabled 도 건다.
 *
 * SSE·WebSocket 은 사용하지 않는다. (F-JIEOJO rules, #71)
 *
 * 알림 조회 실패는 조용히 처리한다. `throwOnError: false` 이므로
 * 이 훅의 오류가 다른 화면으로 번지지 않는다. (완료 조건 — "알림 조회가 실패해도
 * 할 일 목록과 업무 상세는 그대로 동작한다")
 */
export function useNotifications(staffCode: string | undefined) {
  return useQuery({
    queryKey: notificationsKey(staffCode ?? ''),
    queryFn: () => fetchNotifications(staffCode!),
    enabled: !!staffCode,
    refetchInterval: 30_000,
    throwOnError: false,
  })
}

/**
 * 배지용 미읽음 개수만 뽑는다. (F-JIEOJO display — "0이면 숫자를 표시하지 않는다")
 *
 * `useNotifications` 가 폴링하는 캐시를 그대로 쓰므로 별도 요청을 만들지 않는다.
 */
export function useUnreadCount(staffCode: string | undefined): number {
  const query = useNotifications(staffCode)
  return query.data?.unreadCount ?? 0
}

/**
 * 알림 항목 읽음 처리.
 *
 * 성공 시 캐시의 해당 항목을 즉시 읽음 상태로 변경한다. `unreadCount` 도 함께
 * 줄인다. (낙관적 업데이트가 아닌 서버 응답값으로 덮어쓴다)
 */
export function useMarkNotificationRead(staffCode: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: number) => markNotificationRead(notificationId, staffCode),
    onSuccess: (updated: NotificationResponse) => {
      queryClient.setQueryData<NotificationListResponse>(
        notificationsKey(staffCode),
        (prev) => {
          if (!prev) return prev
          const wasUnread = !updated.read
          const patchList = (list: NotificationResponse[]) =>
            list.map((n) => (n.id === updated.id ? updated : n))
          return {
            ...prev,
            unreadCount: wasUnread
              ? Math.max(0, prev.unreadCount - 1)
              : prev.unreadCount,
            today: patchList(prev.today),
            past: patchList(prev.past),
          }
        },
      )
    },
  })
}
