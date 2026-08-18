import { Link } from 'react-router'
import { PageLayout } from '../../shared/ui/PageLayout'
import { CardsLoadFailed, CardsLoading } from './CardsLoadState'
import { safetyFirst } from './handoverCard'
import { CardLink } from './HandoverCardListPage'
import { useHandoverCards } from './useHandoverCards'

/**
 * 유저플로우 "새 플로우 3" n24 — 검토 필요 항목.
 *
 * 어르신을 분리할 수 없는 원문은 확정 카드로 만들지 않고 검토 대상으로 표시한다.
 * (Manyfast F-SNBVHR exceptions) 서버가 `unresolved` 로 갈라 내려주는 항목이 그대로 여기다.
 */
export function UnresolvedCardsPage() {
  const cards = useHandoverCards()
  const unresolved = cards.data?.unresolved ?? []

  return (
    <PageLayout title="검토 필요 항목" backTo="/handover-cards" backLabel="목록으로">
      <header>
        <p className="text-xl text-ink-muted">
          어느 어르신 이야기인지 가리지 못한 항목입니다. 어르신을 지정하기 전까지는 확정 카드가
          되지 않습니다.
        </p>
      </header>

      {cards.isPending && <CardsLoading />}
      {cards.isError && <CardsLoadFailed onRetry={() => void cards.refetch()} />}

      {cards.isSuccess && unresolved.length === 0 && (
        <p className="text-xl text-ink-muted">지금은 가리지 못한 항목이 없습니다.</p>
      )}

      <ul className="flex flex-col gap-6">
        {safetyFirst(unresolved).map((card) => (
          <li key={card.id} className="flex flex-col gap-3">
            <CardLink card={card} />
            {/* n24 → n25. 여기서 어르신을 지정하는 것이 이 항목을 확정하는 유일한 경로다 */}
            <Link
              to={`/handover-cards/${card.id}/edit`}
              className="block rounded-2xl border-2 border-border-card bg-white px-6 py-4 text-center text-xl font-semibold text-ink hover:border-primary hover:bg-primary-soft"
            >
              어르신 지정하고 고치기
            </Link>
          </li>
        ))}
      </ul>
    </PageLayout>
  )
}
