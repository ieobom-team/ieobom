import { apiFetch } from '../../shared/api/client'
import type { JobRole } from '../handover-card/handoverCardApi'

/** 계약은 `docs/contracts/task-api.md` 에 있다. */

export type TaskStatus = 'PENDING' | 'DONE'

/** 담당은 직종 또는 이름 중 하나만 있으면 된다. 서버가 빈 칸을 카드 값으로 메우지 않으므로 둘 다 보낼 수도 있다. */
export type TaskCreateRequest = {
  content: string
  assigneeJobRole?: JobRole
  assigneeName?: string
  /** 당일 `HH:MM`. 날짜는 담지 않는다 */
  dueTime: string
}

export type TaskResponse = {
  id: number
  handoverCardId: number
  careRecipientId: number
  careRecipientName: string
  content: string
  assigneeJobRole: JobRole | null
  assigneeJobRoleLabel: string | null
  assigneeName: string | null
  dueTime: string
  status: TaskStatus
  statusLabel: string
  delegated: boolean
  completedAt: string | null
  completedByName: string | null
  createdAt: string
}

export function createTask(cardId: number, request: TaskCreateRequest): Promise<TaskResponse> {
  return apiFetch<TaskResponse>(`/api/handover-cards/${cardId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
