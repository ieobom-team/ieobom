import { apiFetch } from '../../shared/api/client'
import type { TaskResponse } from '../task/taskApi'

/**
 * 당일 운영 현황이 읽는 업무 목록.
 *
 * 계약은 `docs/contracts/task-api.md` 의 "당일 목록" 절에 있다. 업무 하나의 모양은 배정·완료와 같아서
 * `features/task/taskApi.ts` 의 `TaskResponse` 를 그대로 쓴다. 같은 값을 두 곳에 적으면 둘이 갈라진다.
 */

/** 미처리와 완료를 나눠서. 대시보드(유저플로우 n44 · n45)가 두 영역을 동시에 그린다. */
export type TaskList = {
  date: string
  pending: TaskResponse[]
  done: TaskResponse[]
  /** 목록을 잘라 보여 줘도 줄지 않는 값. 지금 화면은 표시하지 않는다 */
  pendingCount: number
  doneCount: number
}

/** 그날 아직 안 닫힌 것만. 완료를 담을 자리가 없다 (유저플로우 n47 · n48) */
export type TaskBriefing = {
  date: string
  pending: TaskResponse[]
  pendingCount: number
}

/** `date` 를 생략하면 서버가 오늘로 본다. */
export function fetchTasks(date?: string): Promise<TaskList> {
  return apiFetch<TaskList>(date ? `/api/tasks?date=${date}` : '/api/tasks')
}

/**
 * 하원 미처리 브리핑.
 *
 * 대시보드와 같은 데이터를 보지만 **엔드포인트가 다르다.** 서버가 대시보드 조회와 브리핑 확인을 서로
 * 다른 이벤트로 남기기 때문이다. 화면이 조회를 아껴 보겠다고 대시보드 응답을 재사용하면 그 기록이
 * 사라진다. (`docs/contracts/task-api.md`)
 */
export function fetchPendingBriefing(date?: string): Promise<TaskBriefing> {
  return apiFetch<TaskBriefing>(
    date ? `/api/tasks/pending-briefing?date=${date}` : '/api/tasks/pending-briefing',
  )
}
