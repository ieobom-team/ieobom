import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { HandoverCard } from '../handover-card/handoverCardApi'
import {
  flattenCards,
  generalCards,
  getCardStats,
  highlightSummary,
  safetyRelatedCards,
} from '../handover-card/handoverCard'
import { useHandoverCards } from '../handover-card/useHandoverCards'
import { useOfflineQueue } from '../handover/useOfflineQueue'
import { useSession } from '../session/sessionContext'
import { myAssignedTasks, myOpenTasks } from '../task/task'
import { useTasks } from '../task/useTasks'
import { BigButton } from '../../shared/ui/BigButton'
import { PageLayout } from '../../shared/ui/PageLayout'

/**
 * 유저플로우 "새 플로우 3" n4 — 현장 근무자 홈.
 *
 * n6 특이사항 남기기(#6), n18 인계 카드 목록(#11), n61 → n31 업무 목록(#15)이 붙어 있다.
 * 요약 카드·오늘 특이사항 요약은 각 화면이 이미 갖고 있는 데이터의 표시 전용 집계다 — 새 API를
 * 부르지 않는다. (Manyfast F-SNBVHR · F-IVFNPC, #89)
 */
export function FieldHomePage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const offlineQueue = useOfflineQueue()
  const queuedCount = offlineQueue.data?.length ?? 0

  const cards = useHandoverCards()
  const cardStats = cards.data ? getCardStats(cards.data) : null
  const allCards = cards.data ? flattenCards(cards.data) : []
  const safetyHighlights = safetyRelatedCards(allCards)
  const generalHighlights = generalCards(allCards)

  const tasks = useTasks()
  const relevantTasks = tasks.data
    ? [...myAssignedTasks(tasks.data.tasks, session?.staff), ...myOpenTasks(tasks.data.tasks, session?.staff)]
    : []
  const pendingTaskCount = relevantTasks.filter((task) => task.status === 'PENDING').length
  const doneTaskCount = relevantTasks.filter((task) => task.status === 'DONE').length

  return (
    <PageLayout title="현장 홈" showBottomNav>
      {/* 재전송 대기 중임을 다른 화면에서도 잊히지 않게 보여 준다. (Manyfast F-YJJJUX exceptions) */}
      {queuedCount > 0 && (
        <p className="rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900">
          연결을 기다리는 인계 {queuedCount}건이 있습니다. 연결되면 자동으로 보냅니다.
        </p>
      )}

      {/* 요약 카드 2열 그리드. 라벨은 하단 탭바와 같은 말을 쓴다. (DESIGN.md §2.5 · §8.3) */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryTile
          label="인계 카드"
          caption="당일 미검토"
          countLabel={countLabelFor(cards, cardStats?.needsReviewCount)}
          onClick={() => navigate('/handover-cards')}
        />
        <SummaryTile
          label="오늘의 업무"
          caption="미처리"
          countLabel={countLabelFor(tasks, pendingTaskCount)}
          onClick={() => navigate('/tasks')}
        />
      </div>

      <button
        type="button"
        onClick={() => navigate('/tasks')}
        className="flex min-h-14 items-center justify-between rounded-md border border-border-card bg-surface-card px-5 py-4 text-left transition-colors hover:border-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <span className="text-lg font-semibold text-ink">오늘 완료 업무</span>
        <span className="text-2xl font-bold text-success">
          {countLabelFor(tasks, doneTaskCount)}
        </span>
      </button>

      <BigButton onClick={() => navigate('/field/handovers/new')}>
        <span className="block">특이사항 남기기</span>
        <span className="mt-1 block text-lg font-normal opacity-90">
          돌봄 중 있었던 일을 한 번만 남기면 됩니다
        </span>
      </BigButton>

      <section aria-labelledby="today-highlights-heading" className="flex flex-col gap-3">
        <h2 id="today-highlights-heading" className="text-xl font-bold text-ink">
          오늘 특이사항
        </h2>
        <div className="flex flex-col gap-3">
          <HighlightGroup
            tone="safety"
            label="안전"
            cards={safetyHighlights}
            status={queryStatus(cards)}
            onClick={() => navigate('/handover-cards')}
          />
          <HighlightGroup
            tone="general"
            label="일반"
            cards={generalHighlights}
            status={queryStatus(cards)}
            onClick={() => navigate('/handover-cards')}
          />
        </div>
      </section>
    </PageLayout>
  )
}

type QueryLike = { isPending: boolean; isError: boolean }
type Status = 'loading' | 'error' | 'success'

function queryStatus(query: QueryLike): Status {
  if (query.isPending) {
    return 'loading'
  }
  return query.isError ? 'error' : 'success'
}

/** 불러오는 중·실패는 값 대신 그 상태를 그대로 보여 준다. (§2.1 처리 중에도 화면을 비우지 않는다) */
function countLabelFor(query: QueryLike, count: number | undefined): string {
  const status = queryStatus(query)
  if (status === 'loading') {
    return '…'
  }
  if (status === 'error') {
    return '-'
  }
  return `${count ?? 0}건`
}

function SummaryTile({
  label,
  caption,
  countLabel,
  onClick,
}: {
  label: string
  caption: string
  countLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-md border border-border-card bg-surface-card px-4 py-5 text-center transition-colors hover:border-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
    >
      <span className="text-lg font-semibold text-ink">{label}</span>
      <span className="text-3xl font-bold text-primary">{countLabel}</span>
      <span className="text-sm text-ink-muted">{caption}</span>
    </button>
  )
}

function HighlightGroup({
  tone,
  label,
  cards,
  status,
  onClick,
}: {
  tone: 'safety' | 'general'
  label: string
  cards: HandoverCard[]
  status: Status
  onClick: () => void
}) {
  const top: HandoverCard | undefined = cards[0]
  const countText = status === 'loading' ? '…' : status === 'error' ? '-' : `${cards.length}건`

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-1 rounded-md border px-5 py-4 text-left transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${
        tone === 'safety'
          ? 'border-primary bg-primary-soft'
          : 'border-border-card bg-surface-card hover:border-primary hover:bg-primary-soft'
      }`}
    >
      <span className="flex items-center gap-2">
        {tone === 'safety' && (
          <AlertTriangle size={20} strokeWidth={2.4} aria-hidden="true" className="shrink-0 text-primary" />
        )}
        <span className={`text-lg font-bold ${tone === 'safety' ? 'text-primary' : 'text-ink'}`}>
          {label} {countText}
        </span>
      </span>

      {status === 'success' &&
        (top ? (
          <p className="truncate text-base text-ink-muted">
            <span className="font-semibold text-ink">
              {top.careRecipientName ?? '대상 어르신 미정'} 어르신
            </span>{' '}
            · {highlightSummary(top)}
          </p>
        ) : (
          <p className="text-base text-ink-muted">오늘 등록된 특이사항이 없습니다.</p>
        ))}
    </button>
  )
}
