import { Link, useNavigate } from 'react-router'
import { BigButton } from '../../shared/ui/BigButton'
import { SessionHeader } from '../session/SessionHeader'
import { assigneeLabel, dueTimeLabel } from './task'
import { TasksLoadFailed, TasksLoading } from './TaskLoadState'
import type { TaskResponse } from './taskApi'
import { useTasks } from './useTasks'

/**
 * 유저플로우 n31 · n32 — 그날 업무 목록.
 *
 * 서버가 미처리를 먼저 기한 순으로 정렬해 준다(`docs/contracts/task-api.md`). 화면은 그 순서를
 * 그대로 그린다.
 */
export function TaskListPage() {
  const tasks = useTasks()

  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8">
        <header>
          <Link
            to="/field"
            className="rounded-xl px-2 py-2 text-xl font-semibold text-teal-800 underline underline-offset-4"
          >
            현장 홈으로
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">오늘의 업무</h1>
        </header>

        {tasks.isPending && <TasksLoading />}
        {tasks.isError && <TasksLoadFailed onRetry={() => void tasks.refetch()} />}

        {tasks.isSuccess && tasks.data.tasks.length === 0 && (
          <p className="text-xl text-slate-600">오늘 등록된 업무가 없습니다.</p>
        )}

        {tasks.isSuccess && tasks.data.tasks.length > 0 && (
          <ul className="flex flex-col gap-4">
            {tasks.data.tasks.map((task) => (
              <li key={task.id}>
                <TaskListItem task={task} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
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
        <span
          className={`shrink-0 rounded-full px-4 py-2 text-lg font-semibold ${
            isDone ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {task.statusLabel}
        </span>
      </div>
    </BigButton>
  )
}
