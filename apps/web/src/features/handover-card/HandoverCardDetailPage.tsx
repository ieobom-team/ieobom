import { Link, useParams } from 'react-router'
import { SessionHeader } from '../session/SessionHeader'
import { CardsLoadFailed, CardsLoading } from './CardsLoadState'
import { findCard, observedTimeLabel } from './handoverCard'
import { HandoverCardBody } from './HandoverCardBody'
import { useHandoverCards } from './useHandoverCards'

/**
 * 유저플로우 n21 · n22 — 인계 카드 상세.
 *
 * 목록(n20)에서도 들어오고, 관리자 하원 미처리 브리핑(n49 → n21)에서도 들어온다. 그래서 진입
 * 역할로 막지 않는다. (`routes/AppRoutes.tsx`)
 *
 * 카드는 당일 목록 응답에서 찾는다. 단건 조회 API 를 따로 두지 않은 이유는
 * `useHandoverCards.ts` 에 적혀 있다.
 */
export function HandoverCardDetailPage() {
  const { cardId } = useParams()
  const cards = useHandoverCards()

  const parsed = Number(cardId)
  const card =
    cards.data === undefined || !Number.isInteger(parsed) ? null : findCard(cards.data, parsed)
  const observedTime = card === null ? null : observedTimeLabel(card.observedAt)

  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8">
        <Link
          to="/handover-cards"
          className="text-xl font-semibold text-teal-800 underline underline-offset-4"
        >
          목록으로
        </Link>

        {cards.isPending && <CardsLoading />}
        {cards.isError && <CardsLoadFailed onRetry={() => void cards.refetch()} />}

        {cards.isSuccess && card === null && (
          <p className="text-xl text-slate-600">
            그 인계 카드를 찾지 못했습니다. 오늘 목록에 없는 카드일 수 있습니다.
          </p>
        )}

        {card !== null && (
          <>
            <header>
              <h1 className="text-3xl font-bold text-slate-900">
                {card.careRecipientName ?? '대상 어르신 미정'}
              </h1>
              {observedTime !== null && (
                <p className="mt-2 text-xl text-slate-600">오늘 {observedTime}에 있었던 일</p>
              )}
            </header>

            <article className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-5">
              <HandoverCardBody card={card} />
            </article>

            {card.careRecipientId === null && (
              <p className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-xl text-amber-900">
                어느 어르신 이야기인지 아직 가리지 못했습니다. 어르신을 지정하기 전까지는 확정
                카드가 되지 않습니다.
              </p>
            )}

            {card.careRecipientId !== null && card.nextAction !== null && (
              <Link
                to={`/handover-cards/${card.id}/tasks/new`}
                className="block rounded-2xl bg-teal-700 px-6 py-5 text-center text-2xl font-semibold text-white hover:bg-teal-800"
              >
                다음 행동을 후속 업무로 배정하기
              </Link>
            )}

            <p className="text-lg text-slate-500">
              카드 수정과 검토 완료 처리, 문구 복사는 다음 화면에서 붙습니다.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
