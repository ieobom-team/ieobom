import { apiFetch } from '../../shared/api/client'
import type { JobRole } from '../handover-card/handoverCardApi'

/** 계약은 `docs/contracts/task-api.md` 에 있다. */

export type TaskStatus = 'PENDING' | 'DONE'

/** 담당자를 지정하거나 알림 생성에 쓸 두 칸. (#70 댓글, #71)
 *
 * - `assigneeStaffCode`: 담당자를 특정한 경우 그 사번. 직종만 배정하면 없어도 된다.
 *   없으면 알림이 만들어지지 않는다(동명이인 문제).
 * - `assignedByStaffCode`: 배정한 사람의 사번(세션의 staff.code).
 *   없으면 actorName 이 null 이 되어 알림 항목에 배정자가 표시되지 않는다.
 *   또한 자기제외 판정을 못 해 배정자 본인에게도 알림이 생성된다.
 */
export type TaskCreateRequest = {
  content: string
  assigneeJobRole?: JobRole
  assigneeName?: string
  /** 담당자를 특정할 때 그 사번. */
  assigneeStaffCode?: string
  /** 배정한 사람의 사번 (세션 staff.code). */
  assignedByStaffCode?: string
  /** 형식 `HH:MM`. 날짜는 포함하지 않는다 */
  dueTime: string
}

export type ClaimMethod = 'DIRECT_ASSIGN' | 'SELF_CLAIM'

export type TaskResponse = {
  id: number
  handoverCardId: number
  careRecipientId: number
  careRecipientName: string
  content: string
  assigneeJobRole: JobRole | null
  assigneeJobRoleLabel: string | null
  assigneeName: string | null
  /** 담당이 정해진 시각. 담당자가 없으면 `null` */
  claimedAt: string | null
  /** 담당자가 있을 때만 값이 있다 */
  claimMethod: ClaimMethod | null
  claimMethodLabel: string | null
  /** 지금 맡을 수 있는지. 표시용이며 허가가 아니다 — 실제 경합은 서버가 가른다 */
  claimable: boolean
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

export type TaskClaimRequest = {
  staffCode: string
}

export type TaskClaimResponse = {
  /** 참이면 이번 요청으로 담당을 잡았다. */
  claimed: boolean
  /** 참이면 이미 다른 직원이 맡고 있었다. 아무것도 바뀌지 않았다. */
  alreadyClaimed: boolean
  /** 참이면 이미 완료된 업무였다. 아무것도 바뀌지 않았다. */
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

/**
 * 직종에만 배정된 업무를 맡는다. ('내가 처리할게요', `docs/contracts/task-api.md`)
 *
 * 이름과 직종은 보내지 않는다. 서버가 사번으로 명단에서 직접 읽어 배정된 직종과 같은지 검사한다.
 * 맡지 못했어도(이미 다른 직원이 맡음 · 이미 완료됨) 오류가 아니라 `200` 이다.
 */
export function claimTask(
  taskId: number,
  request: TaskClaimRequest,
): Promise<TaskClaimResponse> {
  return apiFetch<TaskClaimResponse>(`/api/tasks/${taskId}/claim`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  })
}
