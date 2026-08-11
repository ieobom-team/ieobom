import { cardEntries, observedTimeLabel, suggestionLabel } from './handoverCard'
import type { HandoverCard } from './handoverCardApi'

/**
 * 카드 한 장의 내용. 목록(n18)과 상세(n21)가 같은 것을 쓴다.
 *
 * 근거 원문은 **접지 않고 항상 펼쳐 둔다.** 이 제품이 "AI가 지어낸 걸 믿게 하지 않는다"고 말할 수 있는
 * 근거가 근거 원문뿐인데, 그걸 한 번 더 눌러야 보이면 아무도 누르지 않는다.
 * (Manyfast F-SNBVHR display — 각 항목에서 원문 근거를 바로 확인)
 */
export function HandoverCardBody({ card }: { card: HandoverCard }) {
  const observedTime = observedTimeLabel(card.observedAt)
  const suggestion = suggestionLabel(card)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <CardBadges card={card} />
        {observedTime !== null && (
          <span className="text-lg text-slate-500">관찰 {observedTime}</span>
        )}
      </div>

      <dl className="flex flex-col gap-3">
        {cardEntries(card).map((entry) => (
          <div key={entry.key} className="flex flex-col gap-1">
            <dt className="text-lg font-semibold text-slate-500">{entry.label}</dt>
            <dd className={`text-xl ${entry.value === null ? 'text-slate-400' : 'text-slate-900'}`}>
              {entry.value ?? '없음'}
            </dd>
            {entry.key === 'nextAction' && suggestion !== null && (
              <dd className="text-lg text-slate-500">{suggestion}</dd>
            )}
          </div>
        ))}
      </dl>

      <figure className="rounded-xl border-l-4 border-slate-300 bg-slate-50 px-4 py-3">
        <figcaption className="text-lg font-semibold text-slate-500">근거 원문</figcaption>
        <blockquote className="mt-1 text-xl text-slate-800">“{card.evidenceText}”</blockquote>
      </figure>
    </div>
  )
}

/**
 * 안전 관련과 검토 필요를 앞머리에 붙인다.
 *
 * 둘 다 서버가 정한 값이다. 안전 여부는 지정 키워드 자동 판정이나 직원 직접 표시에서 오고,
 * 검토 상태는 카드가 만들어질 때 검토 필요로 시작한다.
 */
export function CardBadges({ card }: { card: HandoverCard }) {
  return (
    <>
      {card.safetyRelated && (
        <span className="rounded-full bg-rose-100 px-3 py-1 text-lg font-bold text-rose-900">
          안전 관련
        </span>
      )}
      {card.reviewStatus === 'NEEDS_REVIEW' && (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-lg font-bold text-amber-900">
          검토 필요
        </span>
      )}
      {card.reviewStatus === 'REVIEWED' && (
        <span className="rounded-full bg-teal-100 px-3 py-1 text-lg font-bold text-teal-900">
          검토 완료
        </span>
      )}
    </>
  )
}
