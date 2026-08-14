import { Link } from 'react-router'
import { PageLayout } from '../../shared/ui/PageLayout'
import { CardsLoadFailed, CardsLoading } from '../handover-card/CardsLoadState'
import { dateLabel, totalCardCount } from '../handover-card/handoverCard'
import { useHandoverCards } from '../handover-card/useHandoverCards'
import { TaskRow } from './TaskRow'
import { TasksLoadFailed, TasksLoading } from './TasksLoadState'
import { useTodayTasks } from './useTodayTasks'

/**
 * 유저플로우 "AI 인계 도구 내비게이션 맵" n42 관리자 대시보드 · n43 당일 인계·업무 현황.
 *
 * 당일 인계 · 미처리 업무 · 완료 업무를 **구분해서** 보여 준다. (Manyfast F-HQTFLK display)
 * 이 화면이 하는 일은 하원 전에 오늘 무엇이 확인되지 않았는지를 눈으로 닫는 것 하나다.
 *
 * 인계와 업무를 **따로 부른다.** 한쪽이 실패해도 성공한 쪽은 그대로 보여 줘야 하기 때문이다.
 * (Manyfast F-HQTFLK exceptions) 그래서 로딩·실패·빈 상태를 화면 전체가 아니라 영역마다 그린다.
 *
 * 미처리 영역에는 건수를 함께 붙인다. 명세가 건수를 요구하는 자리는 브리핑(n45 미처리 건수·목록)이지만,
 * 관리자가 먼저 여는 화면이 여기라 같은 숫자를 여기서도 보여 준다. 제목과 나란히 두되 제목 안에 넣지
 * 않는다 — 영역 이름이 "미처리 업무 3건"으로 바뀌면 영역을 이름으로 가리키는 쪽이 숫자에 끌려간다.
 *
 * 데스크톱 웹 기준이다. 현장 입력 화면들과 달리 관리자가 자리에 앉아 보는 화면이다.
 */
export function OperationsDashboardPage() {
  const cards = useHandoverCards()
  const tasks = useTodayTasks()

  const cardList = cards.data
  const taskList = tasks.data
  const 기준일 = taskList?.date ?? cardList?.date

  return (
    <PageLayout
      title="당일 운영 현황"
      showBottomNav
      backTo="/admin"
      backLabel="관리자 홈"
      maxWidth="6xl"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">당일 운영 현황</h1>
          {기준일 !== undefined && (
            <p className="mt-2 text-xl text-slate-600">{dateLabel(기준일)}</p>
          )}
        </div>
        {/* n48 브리핑 선택 — 하원 시점에 미처리를 우선 확인하는 길. (Manyfast F-HQTFLK trigger) */}
        <Link
          to="/admin/briefing"
          className="rounded-2xl bg-teal-700 px-6 py-4 text-xl font-semibold text-white"
        >
          하원 미처리 브리핑 열기
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/*
          영역마다 이름을 달아 둔다. 실패가 화면 전체가 아니라 영역에 붙는 화면이라, 읽는 사람도
          테스트도 "어느 영역이 실패했는지"를 가릴 수 있어야 한다.
        */}
        <section aria-labelledby="dashboard-handovers" className="flex flex-col gap-4">
          <h2 id="dashboard-handovers" className="text-2xl font-bold text-slate-900">
            당일 인계
          </h2>

          {cards.isPending && <CardsLoading />}
          {cards.isError && <CardsLoadFailed onRetry={() => void cards.refetch()} />}

          {cardList !== undefined && cardList.unresolved.length > 0 && (
            /*
              어느 어르신 이야기인지 가리지 못한 항목은 어르신 묶음 안에 섞지 않는다. 섞으면 다음
              근무자가 그걸 그 어르신 이야기로 읽는다. 업무 쪽에는 이런 항목이 없다 — 대상 어르신을
              가리지 못한 카드에서는 업무 생성 자체가 막힌다.
            */
            <Link
              to="/handover-cards/unresolved"
              className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-lg text-amber-900 underline underline-offset-4"
            >
              어느 어르신 이야기인지 가리지 못한 항목이 {cardList.unresolved.length}건 있습니다
            </Link>
          )}

          {cardList !== undefined && totalCardCount(cardList) === 0 && (
            <p className="text-xl text-slate-600">오늘 등록된 인계가 없습니다.</p>
          )}

          <ul className="flex flex-col gap-4">
            {cardList?.recipients.map((recipient) => (
              <li
                key={recipient.careRecipientId}
                className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4"
              >
                <p className="text-xl font-bold text-slate-900">{recipient.careRecipientName}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {recipient.cards.map((card) => (
                    <li key={card.id}>
                      <Link
                        to={`/handover-cards/${card.id}`}
                        className="text-lg text-slate-700 underline underline-offset-4"
                      >
                        {card.statusChange ?? card.nextAction ?? card.evidenceText}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="dashboard-pending" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 id="dashboard-pending" className="text-2xl font-bold text-slate-900">
              미처리 업무
            </h2>
            {taskList !== undefined && (
              <span className="text-2xl font-bold text-teal-800">{taskList.pendingCount}건</span>
            )}
          </div>

          {tasks.isPending && <TasksLoading />}
          {tasks.isError && <TasksLoadFailed onRetry={() => void tasks.refetch()} />}

          {taskList !== undefined && taskList.pending.length === 0 && (
            <p className="text-xl text-slate-600">아직 안 닫힌 업무가 없습니다.</p>
          )}

          <ul className="flex flex-col gap-4">
            {taskList?.pending.map((task) => <TaskRow key={task.id} task={task} />)}
          </ul>
        </section>

        <section aria-labelledby="dashboard-done" className="flex flex-col gap-4">
          <h2 id="dashboard-done" className="text-2xl font-bold text-slate-900">
            완료 업무
          </h2>

          {/* 미처리와 같은 한 번의 조회에서 온다. 그래서 실패도 같이 뜬다. */}
          {tasks.isPending && <TasksLoading />}
          {tasks.isError && <TasksLoadFailed onRetry={() => void tasks.refetch()} />}

          {taskList !== undefined && taskList.done.length === 0 && (
            <p className="text-xl text-slate-600">오늘 완료된 업무가 없습니다.</p>
          )}

          <ul className="flex flex-col gap-4">
            {taskList?.done.map((task) => <TaskRow key={task.id} task={task} />)}
          </ul>
        </section>
      </div>
    </PageLayout>
  )
}
