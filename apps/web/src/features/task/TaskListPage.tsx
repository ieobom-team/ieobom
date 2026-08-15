import { useNavigate } from 'react-router'
import { BigButton } from '../../shared/ui/BigButton'
import { PageLayout } from '../../shared/ui/PageLayout'
import { useSession } from '../session/sessionContext'
import { assigneeLabel, claimStatusLabel, dueTimeLabel } from './task'
import { TasksLoadFailed, TasksLoading } from './TaskLoadState'
import type { TaskResponse } from './taskApi'
import { useTasks } from './useTasks'

/**
 * 유저플로우 "새 플로우 3" n31 · n32 / "새 플로우 5" n39 — 그날 업무 목록.
 *
 * **내게 직접 배정된 업무**와 **내 직종에 열려 있는 업무**를 구분해 보여 준다. (Manyfast F-IVFNPC
 * display) 다른 직원에게 직접 배정된 업무나 내 직종이 아닌 업무는 이 화면에 나오지 않는다 — 그 직원
 * 또는 그 직종 직원의 할 일 목록이 따로 있다.
 *
 * 담당자 판정은 이름 문자열 비교다. 업무 응답에는 담당자 사번이 없다 — 알림 수신자를 가리키는 용도로만
 * 쓰이고 화면에는 내려오지 않는다(`docs/contracts/task-api.md`). 동명이인 구분은 `F-YJJJUX` 와 같은
 * 전제로 이번 범위 밖이다.
 *
 * 서버가 미처리를 먼저 기한 순으로 정렬해 준다. 화면은 그 순서를 그룹 안에서 그대로 유지한다.
 */
export function TaskListPage() {
  const tasks = useTasks()
  const { session } = useSession()

  const myTasks =
    tasks.data?.tasks.filter((task) => task.assigneeName === session?.staff.name) ?? []
  const openTasks =
    tasks.data?.tasks.filter(
      (task) => task.assigneeName === null && task.assigneeJobRole === session?.staff.jobRole,
    ) ?? []

  return (
    <PageLayout title="오늘의 업무" showBottomNav backTo="/field" backLabel="현장 홈">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">오늘의 업무</h1>
      </header>

      {tasks.isPending && <TasksLoading />}
      {tasks.isError && <TasksLoadFailed onRetry={() => void tasks.refetch()} />}

      {tasks.isSuccess && myTasks.length === 0 && openTasks.length === 0 && (
        <p className="text-xl text-slate-600">오늘 등록된 업무가 없습니다.</p>
      )}

      {tasks.isSuccess && myTasks.length > 0 && (
        <TaskGroup title="내게 배정된 업무" tasks={myTasks} />
      )}

      {tasks.isSuccess && openTasks.length > 0 && (
        <TaskGroup title="내 직종에 열려 있는 업무" tasks={openTasks} />
      )}
    </PageLayout>
  )
}

function TaskGroup({ title, tasks }: { title: string; tasks: TaskResponse[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <ul className="flex flex-col gap-4">
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskListItem task={task} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** n34 — 업무 선택. 상태를 뱃지로 앞세워, 미처리부터 훑어도 눈에 먼저 들어오게 한다. */
function TaskListItem({ task }: { task: TaskResponse }) {
  const navigate = useNavigate()
  const isDone = task.status === 'DONE'

  return (
    <BigButton tone="plain" onClick={() => navigate(`/tasks/${task.id}`)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold text-slate-900">{task.content}</p>
          <p className="text-lg text-slate-600">{task.careRecipientName}</p>
          <p className="text-lg text-slate-600">
            {assigneeLabel(task)} · {dueTimeLabel(task)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`rounded-full px-4 py-2 text-lg font-semibold ${
              isDone ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {task.statusLabel}
          </span>
          {/* 담당 표시는 직종만 배정 · 담당자 확정 두 가지를 구분한다. (Manyfast F-IVFNPC display) */}
          <span
            className={`rounded-full px-3 py-1 text-base font-semibold ${
              task.assigneeName === null
                ? 'bg-slate-100 text-slate-700'
                : 'bg-teal-100 text-teal-900'
            }`}
          >
            {claimStatusLabel(task)}
          </span>
        </div>
      </div>
    </BigButton>
  )
}
