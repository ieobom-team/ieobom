import { Link } from 'react-router'
import { PageLayout } from '../../shared/ui/PageLayout'
import { CardsLoadFailed, CardsLoading } from '../handover-card/CardsLoadState'
import { dateLabel, getCardStats, totalCardCount } from '../handover-card/handoverCard'
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
  const cardStats = cardList ? getCardStats(cardList) : null
  const taskTotal = taskList ? taskList.pendingCount + taskList.doneCount : null

  return (
    <PageLayout
      title="당일 운영 현황"
      showBottomNav
      backTo="/admin"
      backLabel="관리자 홈"
      maxWidth="6xl"
    >
      {기준일 !== undefined && <p className="text-xl text-ink-muted">{dateLabel(기준일)}</p>}

      {/* 인계 요약 — 기존 getCardStats 재사용, 새 API 없음 (Manyfast F-SNBVHR와 같은 데이터) */}
      <section aria-label="인계 요약" className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-ink">인계 요약</h2>
        {cards.isPending && <CardsLoading />}
        {cards.isError && <CardsLoadFailed onRetry={() => void cards.refetch()} />}
        {cardStats !== null && (
          <div className="grid max-w-2xl grid-cols-3 gap-3">
            <StatTile label="전체" value={cardStats.totalCount} />
            <StatTile label="검토 필요" value={cardStats.needsReviewCount} tone="primary" />
            <StatTile label="검토 완료" value={cardStats.reviewedCount} tone="success" />
          </div>
        )}
      </section>

      {/*
        후속 업무 — 기존 taskList.pendingCount·doneCount 재사용. "기한 임박" 타일은 도입하지 않는다.

        이동 링크는 두지 않는다. /tasks(TaskListPage)는 "내게 배정된 업무 + 내 직종에 열려 있는
        업무"만 보여주는 개인 스코프 화면이라 관리자가 누르면 자기 몫만 보이고 나머지는 빠진다.
        관리자 전용 전체 업무 목록 라우트는 따로 없고, 이 페이지 아래 미처리·완료 컬럼이 이미
        조직 전체(비필터) 목록을 그대로 보여주므로 별도 링크 없이 스크롤해서 보면 된다.
      */}
      <section aria-label="후속 업무" className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-ink">후속 업무</h2>
        {tasks.isPending && <TasksLoading />}
        {tasks.isError && <TasksLoadFailed onRetry={() => void tasks.refetch()} />}
        {taskList !== undefined && taskTotal !== null && (
          <div className="grid max-w-2xl grid-cols-3 gap-3">
            <StatTile label="전체" value={taskTotal} />
            <StatTile label="미처리" value={taskList.pendingCount} tone="primary" />
            <StatTile label="완료" value={taskList.doneCount} tone="success" />
          </div>
        )}
      </section>

      {/* 하원 전 미처리 브리핑 — 기존 링크·이동 경로(/admin/briefing) 동일, 경고 박스로 재구성 */}
      {taskList !== undefined && (
        <section
          aria-label="하원 전 미처리 브리핑"
          className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-primary-soft px-5 py-5"
        >
          <p className="text-lg font-semibold text-primary">
            ! 미처리 항목 {taskList.pendingCount}건이 하원 전까지 확인이 필요합니다
          </p>
          {/* n48 브리핑 선택 — 하원 시점에 미처리를 우선 확인하는 길. (Manyfast F-HQTFLK trigger) */}
          <Link
            to="/admin/briefing"
            className="w-fit rounded-2xl bg-primary px-6 py-3 text-lg font-semibold text-white hover:brightness-95"
          >
            하원 미처리 브리핑 열기
          </Link>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/*
          영역마다 이름을 달아 둔다. 실패가 화면 전체가 아니라 영역에 붙는 화면이라, 읽는 사람도
          테스트도 "어느 영역이 실패했는지"를 가릴 수 있어야 한다.
        */}
        <section aria-labelledby="dashboard-handovers" className="flex flex-col gap-4">
          <h2 id="dashboard-handovers" className="text-2xl font-bold text-ink">
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
            <p className="text-xl text-ink-muted">오늘 등록된 인계가 없습니다.</p>
          )}

          <ul className="flex flex-col gap-4">
            {cardList?.recipients.map((recipient) => (
              <li
                key={recipient.careRecipientId}
                className="rounded-2xl border-2 border-border-card bg-white px-5 py-4"
              >
                <p className="text-xl font-bold text-ink">{recipient.careRecipientName}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {recipient.cards.map((card) => (
                    <li key={card.id}>
                      <Link
                        to={`/handover-cards/${card.id}`}
                        className="text-lg text-ink hover:text-primary underline underline-offset-4"
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
            <h2 id="dashboard-pending" className="text-2xl font-bold text-ink">
              미처리 업무
            </h2>
            {taskList !== undefined && (
              <span className="text-2xl font-bold text-primary">{taskList.pendingCount}건</span>
            )}
          </div>

          {tasks.isPending && <TasksLoading />}
          {tasks.isError && <TasksLoadFailed onRetry={() => void tasks.refetch()} />}

          {taskList !== undefined && taskList.pending.length === 0 && (
            <p className="text-xl text-ink-muted">아직 안 닫힌 업무가 없습니다.</p>
          )}

          <ul className="flex flex-col gap-4">
            {taskList?.pending.map((task) => <TaskRow key={task.id} task={task} />)}
          </ul>
        </section>

        <section aria-labelledby="dashboard-done" className="flex flex-col gap-4">
          <h2 id="dashboard-done" className="text-2xl font-bold text-ink">
            완료 업무
          </h2>

          {/* 미처리와 같은 한 번의 조회에서 온다. 그래서 실패도 같이 뜬다. */}
          {tasks.isPending && <TasksLoading />}
          {tasks.isError && <TasksLoadFailed onRetry={() => void tasks.refetch()} />}

          {taskList !== undefined && taskList.done.length === 0 && (
            <p className="text-xl text-ink-muted">오늘 완료된 업무가 없습니다.</p>
          )}

          <ul className="flex flex-col gap-4">
            {taskList?.done.map((task) => <TaskRow key={task.id} task={task} />)}
          </ul>
        </section>
      </div>
    </PageLayout>
  )
}

/** 현황 요약 타일. 비상호작용 · 표시 전용 — 기존 집계(getCardStats · taskList) 값만 그대로 보여준다. */
function StatTile({
  label,
  value,
  tone = 'ink',
}: {
  label: string
  value: number
  tone?: 'ink' | 'primary' | 'success'
}) {
  const valueClass = tone === 'primary' ? 'text-primary' : tone === 'success' ? 'text-success' : 'text-ink'

  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border-card bg-surface-card px-3 py-4">
      <span className="text-base font-semibold text-ink-muted">{label}</span>
      <span className={`text-3xl font-bold ${valueClass}`}>{value}개</span>
    </div>
  )
}
