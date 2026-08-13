import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTask, fetchTasks, type TaskListResponse, type TaskResponse } from './taskApi'

/** 목록 화면이 쓰는 캐시 키. */
export const TASKS_KEY = ['tasks', 'today'] as const

/** 상세 화면이 쓰는 캐시 키. 카드와 달리 업무는 단건 조회 API 가 있어 목록 캐시에 기대지 않는다. */
export const taskKey = (taskId: number) => ['tasks', taskId] as const

/** 그날 업무 전체. 서버가 미처리를 먼저 기한 순으로 정렬해 준다. */
export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: () => fetchTasks() })
}

/** 업무 하나. 목록을 거치지 않고 바로 열어도(북마크·새로고침) 조회된다. (유저플로우 "새 플로우 3" n34) */
export function useTask(taskId: number) {
  return useQuery({
    queryKey: taskKey(taskId),
    queryFn: () => fetchTask(taskId),
    enabled: Number.isInteger(taskId),
  })
}

/**
 * 완료 처리 응답의 업무 한 건을 목록·상세 캐시에 되꽂는다.
 *
 * 다시 받아 오지 않는다. 완료 API 가 **고쳐진 업무 한 건을 그대로 돌려주므로**(계약), 그 한 건만
 * 갈아 끼우면 목록·상세가 다시 불러오지 않고도 최신이 된다. 정렬(미처리 먼저)은 다음 조회 때 서버가
 * 다시 매긴다 — 캐시에서는 그 자리 그대로 상태만 바뀐 채로 보여도 화면이 틀리지 않는다.
 */
export function useTaskCacheUpdate() {
  const queryClient = useQueryClient()

  return (task: TaskResponse) => {
    queryClient.setQueryData<TaskListResponse>(TASKS_KEY, (list) =>
      list === undefined
        ? list
        : { ...list, tasks: list.tasks.map((item) => (item.id === task.id ? task : item)) },
    )
    queryClient.setQueryData<TaskResponse>(taskKey(task.id), task)
  }
}
