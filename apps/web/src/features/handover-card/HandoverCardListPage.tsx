import { Link } from 'react-router'
import { SessionHeader } from '../session/SessionHeader'
import { CardsLoadFailed, CardsLoading } from './CardsLoadState'
import { dateLabel, safetyFirst, totalCardCount } from './handoverCard'
import type { HandoverCard } from './handoverCardApi'
import { HandoverCardBody } from './HandoverCardBody'
import { useHandoverCards } from './useHandoverCards'

/**
 * 유저플로우 n18 · n19 — 어르신별 인계 카드 목록.
 *
 * 어르신을 가리지 못한 항목(n23 negative)은 여기 섞지 않고 n24 화면으로 보낸다. 목록에는
 * 몇 건이 그쪽에 있는지만 알린다. 누구의 것인지 모르는 카드가 어르신 묶음 안에 그려지면
 * 다음 근무자가 그걸 그 어르신 이야기로 읽는다.
 *
 * 카드 수정과 검토 완료 처리는 이 Issue(#11) 범위가 아니다. 여기서는 읽기만 한다.
 */
export function HandoverCardListPage() {
  const cards = useHandoverCards()
  const list = cards.data

  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">인계 카드</h1>
          {list !== undefined && (
            <p className="mt-2 text-xl text-slate-600">
              {dateLabel(list.date)} · 모두 {totalCardCount(list)}건
            </p>
          )}
        </header>

        {cards.isPending && <CardsLoading />}
        {cards.isError && <CardsLoadFailed onRetry={() => void cards.refetch()} />}

        {list !== undefined && list.unresolved.length > 0 && (
          <Link
            to="/handover-cards/unresolved"
            className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900 underline underline-offset-4"
          >
            어느 어르신 이야기인지 가리지 못한 항목이 {list.unresolved.length}건 있습니다. 확인하기
          </Link>
        )}

        {list !== undefined && totalCardCount(list) === 0 && (
          <p className="text-xl text-slate-600">
            아직 정리된 인계 카드가 없습니다. 특이사항을 남기면 여기에 쌓입니다.
          </p>
        )}

        {list?.recipients.map((recipient) => (
          <section key={recipient.careRecipientId} className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-slate-900">
              {recipient.careRecipientName}
              <span className="ml-2 text-xl font-normal text-slate-500">
                {recipient.cards.length}건
              </span>
            </h2>
            <ul className="flex flex-col gap-4">
              {safetyFirst(recipient.cards).map((card) => (
                <li key={card.id}>
                  <CardLink card={card} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  )
}

/** n20 — 카드를 고르면 상세로 간다. 카드 전체가 하나의 큰 버튼이다. */
export function CardLink({ card }: { card: HandoverCard }) {
  const border = card.safetyRelated ? 'border-rose-300' : 'border-slate-200'

  return (
    <Link
      to={`/handover-cards/${card.id}`}
      className={`block rounded-2xl border-2 ${border} bg-white px-5 py-5 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300`}
    >
      <HandoverCardBody card={card} />
    </Link>
  )
}
