import { apiFetch } from '../../shared/api/client'
import type { TaskResponse } from '../task/taskApi'

/**
 * 알림 API 타입 및 호출 함수.
 *
 * 계약은 `docs/contracts/notification-api.md` 를 따른다. (#70, #71)
 * - `GET /api/notifications?staffCode=`  → NotificationListResponse
 * - `PATCH /api/notifications/{id}/read` → NotificationResponse (읽음 처리)
 *
 * 알림 유형 3종: TASK_ASSIGNED(새 업무 배정), TASK_REASSIGNED(담당 변경),
 * TASK_DELEGATED_COMPLETE(대리 완료). (F-JIEOJO display)
 */

export type NotificationType = 'TASK_ASSIGNED' | 'TASK_REASSIGNED' | 'TASK_DELEGATED_COMPLETE'

/** 알림 항목 하나. task 는 task-api.md 의 TaskResponse 와 동일한 모양. */
export type NotificationResponse = {
  id: number
  type: NotificationType
  typeLabel: string
  read: boolean
  /** 알림을 만든 사람 이름 (배정자·변경자·대리 완료자). */
  actorName: string
  /** 안전 관련 카드에서 나온 업무 여부. (F-JIEOJO display — 상단 배치 기준) */
  safetyRelated: boolean
  createdAt: string
  readAt: string | null
  task: TaskResponse
}

export type NotificationGroup = 'today' | 'past'

export type NotificationListResponse = {
  /** 읽지 않은 개수. 당일 생성분만 센다. (F-JIEOJO display) */
  unreadCount: number
  today: NotificationResponse[]
  past: NotificationResponse[]
}

export type MarkReadRequest = {
  staffCode: string
}

/**
 * 내 알림 목록을 조회한다.
 *
 * 정렬(안전 관련 우선 → 최신순)과 오늘/지난 분리는 서버가 한다.
 * 화면에서 다시 나누거나 정렬하지 않는다. (F-JIEOJO rules + #70 댓글)
 */
export function fetchNotifications(staffCode: string): Promise<NotificationListResponse> {
  return apiFetch<NotificationListResponse>(
    `/api/notifications?staffCode=${encodeURIComponent(staffCode)}`,
  )
}

/**
 * 알림을 읽음 처리한다. 이미 읽은 알림은 200이고 readAt 을 바꾸지 않는다.
 *
 * 항목을 눌렀을 때만 호출한다. 목록을 여는 것만으로는 읽음이 되지 않는다.
 * (F-JIEOJO display — "항목을 눌렀을 때만 읽음 처리")
 */
export function markNotificationRead(
  notificationId: number,
  staffCode: string,
): Promise<NotificationResponse> {
  return apiFetch<NotificationResponse>(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ staffCode } satisfies MarkReadRequest),
  })
}
