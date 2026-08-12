import { Link } from 'react-router'
import { dateLabel } from '../handover-card/handoverCard'
import { SessionHeader } from '../session/SessionHeader'
import { TaskRow } from './TaskRow'
import { TasksLoadFailed, TasksLoading } from './TasksLoadState'
import { usePendingBriefing } from './useTodayTasks'

/**
 * 유저플로우 n47 · n48 — 하원 미처리 브리핑.
 *
 * 그날 아직 닫히지 않은 업무만 한 화면에서 본다. (Manyfast F-HQTFLK display)
 *
 * **이 화면은 누락을 막아 준다고 약속하지 않는다.** 지연 재알림도 다음 교대 자동 승계도 이 제품에
 * 없어서, 여기 뜬 것을 닫는 것은 사람이다. (Manyfast F-HQTFLK rules) 그래서 "확인했음" 같은 버튼을
 * 두지 않는다 — 누르는 순간 닫은 것처럼 보이지만 실제로 닫히는 것은 없다.
 *
 * 화면을 여는 것 자체가 브리핑 확인 이벤트다. 대시보드와 캐시 키를 나눠 두어 이 화면에 들어올 때마다
 * 서버에 기록이 남는다.
 */
export function UnprocessedBriefingPage() {
  const briefing = usePendingBriefing()
  const list = briefing.data

  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8">
        <header>
          <Link to="/admin/dashboard" className="text-lg text-slate-600 underline underline-offset-4">
            당일 운영 현황으로
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">하원 미처리 브리핑</h1>
          {list !== undefined && <p className="mt-2 text-xl text-slate-600">{dateLabel(list.date)}</p>}
          <p className="mt-2 text-lg text-slate-600">
            아직 닫히지 않은 업무입니다. 다음 날로 넘어가지 않습니다.
          </p>
        </header>

        {briefing.isPending && <TasksLoading />}
        {briefing.isError && <TasksLoadFailed onRetry={() => void briefing.refetch()} />}

        {list !== undefined && list.pending.length === 0 && (
          <p className="text-xl text-slate-600">지금 미처리로 남은 업무가 없습니다.</p>
        )}

        <ul className="flex flex-col gap-4">
          {list?.pending.map((task) => <TaskRow key={task.id} task={task} />)}
        </ul>
      </main>
    </div>
  )
}
