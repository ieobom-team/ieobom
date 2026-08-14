import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from 'react-router'
import { PageLayout } from '../../shared/ui/PageLayout'
import { CardsLoadFailed, CardsLoading } from './CardsLoadState'
import {
  createdAtTimeLabel,
  dateLabel,
  extractRecipients,
  filterCards,
  flattenCards,
  getCardStats,
  sortLatestFirst,
  type CardFilterType,
} from './handoverCard'
import type { HandoverCard } from './handoverCardApi'
import { HandoverCardBody } from './HandoverCardBody'
import { useHandoverCards } from './useHandoverCards'

/**
 * 인계 카드 목록 — '당일 검토 Inbox' 화면.
 *
 * 기본 진입 시 사람이 확인해야 할 `검토 필요` 카드만 최신 등록순으로 보여주고,
 * 안전 관련 카드는 검토 필요 목록 내에서 붉은 테두리와 배지로 강조해 상단에 둔다.
 * 검토 완료된 카드는 기본 화면에서 접어두어 당일 검토 잔여 업무에 집중하게 한다.
 * (Manyfast F-SNBVHR display · rules · action)
 */
export function HandoverCardListPage() {
  const cards = useHandoverCards()
  const list = cards.data

  const [activeFilter, setActiveFilter] = useState<CardFilterType>('NEEDS_REVIEW')
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null)
  const [isReviewedExpanded, setIsReviewedExpanded] = useState(false)

  const allCards = list !== undefined ? flattenCards(list) : []
  const stats = list !== undefined ? getCardStats(list) : null
  const recipients = list !== undefined ? extractRecipients(list) : []

  const displayCards = list !== undefined
    ? filterCards(allCards, activeFilter, selectedRecipientId)
    : []

  const reviewedCardsForRecipient = list !== undefined && activeFilter === 'NEEDS_REVIEW'
    ? sortLatestFirst(
        allCards.filter(
          (c) =>
            c.reviewStatus === 'REVIEWED' &&
            (selectedRecipientId === null || c.careRecipientId === selectedRecipientId),
        ),
      )
    : []

  return (
    <PageLayout title="인계 카드" showBottomNav backTo="/field" backLabel="현장 홈">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">인계 카드</h1>
        {list !== undefined && stats !== null && (
          <p className="text-xl text-slate-600">
            {dateLabel(list.date)} · 모두 {stats.totalCount}건
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

      {list !== undefined && stats !== null && (
        <div className="flex flex-col gap-3">
          {/* 상단 탭 필터 칩 */}
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="카드 상태 필터">
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'NEEDS_REVIEW'}
              onClick={() => setActiveFilter('NEEDS_REVIEW')}
              className={`rounded-2xl px-5 py-3 text-lg font-bold transition-colors ${
                activeFilter === 'NEEDS_REVIEW'
                  ? 'bg-amber-600 text-white'
                  : 'border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              검토 필요 {stats.needsReviewCount}건
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'SAFETY'}
              onClick={() => setActiveFilter('SAFETY')}
              className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-lg font-bold transition-colors ${
                activeFilter === 'SAFETY'
                  ? 'bg-rose-600 text-white'
                  : 'border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle size={20} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
              <span>안전 관련 {stats.safetyCount}건</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'REVIEWED'}
              onClick={() => setActiveFilter('REVIEWED')}
              className={`rounded-2xl px-5 py-3 text-lg font-bold transition-colors ${
                activeFilter === 'REVIEWED'
                  ? 'bg-teal-700 text-white'
                  : 'border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              검토 완료 {stats.reviewedCount}건
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'ALL'}
              onClick={() => setActiveFilter('ALL')}
              className={`rounded-2xl px-5 py-3 text-lg font-bold transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              전체 {stats.totalCount}건
            </button>
          </div>

          {/* 어르신 선택 필터 */}
          {recipients.length > 0 && (
            <div className="flex items-center gap-3">
              <label htmlFor="recipient-filter" className="text-lg font-semibold text-slate-700">
                어르신 선택:
              </label>
              <select
                id="recipient-filter"
                value={selectedRecipientId ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedRecipientId(val === '' ? null : Number(val))
                }}
                className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-lg text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="">전체 어르신 ({recipients.length}명)</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* 목록이 완전히 비어 있을 때 */}
      {list !== undefined && stats !== null && stats.totalCount === 0 && (
        <p className="text-xl text-slate-600">
          아직 정리된 인계 카드가 없습니다. 특이사항을 남기면 여기에 쌓입니다.
        </p>
      )}

      {/* 현재 필터 조건에 해당하는 카드가 없을 때 */}
      {list !== undefined && stats !== null && stats.totalCount > 0 && displayCards.length === 0 && (
        <p className="text-xl text-slate-600">
          {activeFilter === 'NEEDS_REVIEW' && '현재 검토 필요한 인계 카드가 없습니다.'}
          {activeFilter === 'SAFETY' && '안전 관련 인계 카드가 없습니다.'}
          {activeFilter === 'REVIEWED' && '검토 완료된 인계 카드가 없습니다.'}
          {activeFilter === 'ALL' && '조건에 맞는 인계 카드가 없습니다.'}
        </p>
      )}

      {/* 카드 피드 목록 */}
      {displayCards.length > 0 && (
        <ul className="flex flex-col gap-4">
          {displayCards.map((card) => (
            <li key={card.id}>
              <CardLink card={card} />
            </li>
          ))}
        </ul>
      )}

      {/* 검토 필요 탭일 때, 접힌 검토 완료 카드 섹션 */}
      {activeFilter === 'NEEDS_REVIEW' && reviewedCardsForRecipient.length > 0 && (
        <section className="mt-4 flex flex-col gap-4 border-t-2 border-slate-200 pt-6">
          <button
            type="button"
            onClick={() => setIsReviewedExpanded(!isReviewedExpanded)}
            className="flex items-center justify-between rounded-2xl border-2 border-slate-300 bg-slate-100 px-6 py-4 text-xl font-semibold text-slate-800 hover:bg-slate-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
          >
            <span>검토 완료 카드 {reviewedCardsForRecipient.length}건 {isReviewedExpanded ? '접기' : '보기'}</span>
            {isReviewedExpanded ? (
              <ChevronUp size={24} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
            ) : (
              <ChevronDown size={24} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
            )}
          </button>

          {isReviewedExpanded && (
            <ul className="flex flex-col gap-4">
              {reviewedCardsForRecipient.map((card) => (
                <li key={card.id}>
                  <CardLink card={card} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </PageLayout>
  )
}

/** n20 — 카드를 고르면 상세로 간다. 카드 전체가 하나의 큰 버튼이다. */
export function CardLink({ card }: { card: HandoverCard }) {
  const border = card.safetyRelated
    ? 'border-rose-400 bg-rose-50/20'
    : 'border-slate-200 bg-white'

  const createdTime = createdAtTimeLabel(card.createdAt)

  return (
    <Link
      to={`/handover-cards/${card.id}`}
      className={`block rounded-2xl border-2 ${border} px-5 py-5 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300`}
    >
      {/* 카드 상단 헤더: 어르신 이름과 등록 시각 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 className="text-2xl font-bold text-slate-900">
          {card.careRecipientName ?? '대상 어르신 미정'}
          {card.careRecipientName && <span className="ml-1 text-xl font-normal text-slate-600">어르신</span>}
        </h2>
        {createdTime !== null && (
          <span className="text-lg text-slate-500">등록 {createdTime}</span>
        )}
      </div>

      <HandoverCardBody card={card} />
    </Link>
  )
}
