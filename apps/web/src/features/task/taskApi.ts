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

export type TaskListResponse = {
  date: string
  /** 미처리를 먼저 기한 순으로, 완료는 뒤에 같은 기준으로 준다. 서버 정렬을 그대로 쓴다. */
  tasks: TaskResponse[]
}

export type TaskCompleteRequest = {
  completedByName: string
}

export type TaskCompleteResponse = {
  /** 참이면 이번 요청 전에 이미 완료였다는 뜻이다. 아무것도 바뀌지 않았다. */
  alreadyCompleted: boolean
  notice: string | null
  task: TaskResponse
}

export function createTask(cardId: number, request: TaskCreateRequest): Promise<TaskResponse> {
  return apiFetch<TaskResponse>(`/api/handover-cards/${cardId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/** `date` 를 생략하면 서버가 오늘로 본다. */
export function fetchTasks(date?: string): Promise<TaskListResponse> {
  return apiFetch<TaskListResponse>(date ? `/api/tasks?date=${date}` : '/api/tasks')
}

export function fetchTask(taskId: number): Promise<TaskResponse> {
  return apiFetch<TaskResponse>(`/api/tasks/${taskId}`)
}

/** 확인자가 담당자와 달라도 된다(대리 완료). 이미 완료된 업무에 보내도 오류가 아니다. */
export function completeTask(
  taskId: number,
  request: TaskCompleteRequest,
): Promise<TaskCompleteResponse> {
  return apiFetch<TaskCompleteResponse>(`/api/tasks/${taskId}/complete`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  })
}
