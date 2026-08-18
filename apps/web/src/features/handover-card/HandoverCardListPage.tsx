import { useState, type ComponentType } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Search, type LucideProps } from 'lucide-react'
import { Link } from 'react-router'
import { PageLayout } from '../../shared/ui/PageLayout'
import { CardsLoadFailed, CardsLoading } from './CardsLoadState'
import {
  createdAtTimeLabel,
  dateLabelWithWeekday,
  filterByRecipientName,
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
 * 안전 관련 카드는 검토 필요 목록 내에서 primary 강조로 상단에 둔다.
 * 검토 완료된 카드는 기본 화면에서 접어두어 당일 검토 잔여 업무에 집중하게 한다.
 * (Manyfast F-SNBVHR display · rules · action)
 *
 * 화면 제목은 헤더 2행(`AppHeader`)이 보여준다 — 본문에 별도 `<h1>`을 두지 않는다(#88 후속 코멘트).
 */
export function HandoverCardListPage() {
  const cards = useHandoverCards()
  const list = cards.data

  const [activeFilter, setActiveFilter] = useState<CardFilterType>('NEEDS_REVIEW')
  const [keyword, setKeyword] = useState('')
  const [isReviewedExpanded, setIsReviewedExpanded] = useState(false)

  const allCards = list !== undefined ? flattenCards(list) : []
  const stats = list !== undefined ? getCardStats(list) : null

  const displayCards = list !== undefined
    ? filterByRecipientName(filterCards(allCards, activeFilter), keyword)
    : []

  const reviewedCardsForRecipient = list !== undefined && activeFilter === 'NEEDS_REVIEW'
    ? filterByRecipientName(
        sortLatestFirst(allCards.filter((c) => c.reviewStatus === 'REVIEWED')),
        keyword,
      )
    : []

  return (
    <PageLayout title="오늘의 인계 카드" showBottomNav backTo="/field" backLabel="현장 홈">
      {list !== undefined && (
        <p className="text-lg text-ink-muted">{dateLabelWithWeekday(list.date)}</p>
      )}

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

      {stats !== null && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="전체" value={stats.totalCount} />
            <StatTile label="검토 필요" value={stats.needsReviewCount} tone="primary" />
            <StatTile label="검토 완료" value={stats.reviewedCount} tone="success" />
          </div>

          <div className="flex flex-col gap-3">
            {/* 어르신 이름 검색 (HandoverCreatePage TargetStep과 동일한 실시간 부분일치 방식) */}
            <div className="relative">
              <Search
                size={20}
                strokeWidth={2.2}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary"
              />
              <input
                type="search"
                aria-label="어르신 이름 검색"
                placeholder="어르신 이름 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full rounded-md border border-border-card bg-white py-3 pl-11 pr-4 text-lg text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none"
              />
            </div>

            {/* 상단 필터 칩 — 시안 순서: 전체 / 검토 필요 / 검토 완료 / 안전 관련 */}
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="카드 상태 필터">
              <FilterChip
                label="전체"
                count={stats.totalCount}
                active={activeFilter === 'ALL'}
                onClick={() => setActiveFilter('ALL')}
              />
              <FilterChip
                label="검토 필요"
                count={stats.needsReviewCount}
                active={activeFilter === 'NEEDS_REVIEW'}
                onClick={() => setActiveFilter('NEEDS_REVIEW')}
              />
              <FilterChip
                label="검토 완료"
                count={stats.reviewedCount}
                active={activeFilter === 'REVIEWED'}
                onClick={() => setActiveFilter('REVIEWED')}
              />
              <FilterChip
                label="안전 관련"
                count={stats.safetyCount}
                active={activeFilter === 'SAFETY'}
                onClick={() => setActiveFilter('SAFETY')}
                Icon={AlertTriangle}
              />
            </div>
          </div>
        </>
      )}

      {/* 목록이 완전히 비어 있을 때 */}
      {stats !== null && stats.totalCount === 0 && (
        <p className="text-xl text-ink-muted">
          아직 정리된 인계 카드가 없습니다. 특이사항을 남기면 여기에 쌓입니다.
        </p>
      )}

      {/* 현재 필터·검색 조건에 해당하는 카드가 없을 때 */}
      {stats !== null && stats.totalCount > 0 && displayCards.length === 0 && (
        <p className="text-xl text-ink-muted">{emptyResultMessage(activeFilter, keyword)}</p>
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
        <section className="mt-4 flex flex-col gap-4 border-t-2 border-border-divider pt-6">
          <button
            type="button"
            onClick={() => setIsReviewedExpanded(!isReviewedExpanded)}
            className="flex items-center justify-between rounded-2xl border-2 border-border-card bg-btn-neutral px-6 py-4 text-xl font-semibold text-ink hover:brightness-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
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

function emptyResultMessage(filter: CardFilterType, keyword: string): string {
  if (keyword.trim() !== '') {
    return '검색한 이름의 인계 카드가 없습니다.'
  }
  switch (filter) {
    case 'NEEDS_REVIEW':
      return '현재 검토 필요한 인계 카드가 없습니다.'
    case 'SAFETY':
      return '안전 관련 인계 카드가 없습니다.'
    case 'REVIEWED':
      return '검토 완료된 인계 카드가 없습니다.'
    case 'ALL':
    default:
      return '조건에 맞는 인계 카드가 없습니다.'
  }
}

/** 현황 요약 타일. 비상호작용 · 표시 전용(Manyfast F-SNBVHR과 무관, `getCardStats` 값만 그대로 보여준다). */
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

/** 상단 필터 칩 하나. 선택 시 primary 채움, 미선택 시 아웃라인(§8.4 Mode Selector). */
function FilterChip({
  label,
  count,
  active,
  onClick,
  Icon,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  Icon?: ComponentType<LucideProps>
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-lg font-semibold transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'border border-border-card bg-white text-ink hover:bg-primary-soft'
      }`}
    >
      {Icon && <Icon size={18} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />}
      <span>
        {label} {count}건
      </span>
    </button>
  )
}

/** n20 — 카드를 고르면 상세로 간다. 카드 전체가 하나의 큰 버튼이다. */
export function CardLink({ card }: { card: HandoverCard }) {
  const border = card.safetyRelated
    ? 'border-primary bg-primary-soft/50'
    : 'border-border-card bg-white'

  const createdTime = createdAtTimeLabel(card.createdAt)

  return (
    <Link
      to={`/handover-cards/${card.id}`}
      className={`block rounded-2xl border-2 ${border} px-5 py-5 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30`}
    >
      {/* 카드 상단 헤더: 어르신 이름과 등록 시각 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border-divider pb-3">
        <h2 className="text-2xl font-bold text-ink">
          {card.careRecipientName ?? '대상 어르신 미정'}
          {card.careRecipientName && <span className="ml-1 text-xl font-normal text-ink-muted">어르신</span>}
        </h2>
        {createdTime !== null && (
          <span className="text-lg text-ink-muted">등록 {createdTime}</span>
        )}
      </div>

      <HandoverCardBody card={card} />
    </Link>
  )
}
