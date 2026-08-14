import { Link, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '../../shared/api/client'
import { BigButton } from '../../shared/ui/BigButton'
import { PageLayout } from '../../shared/ui/PageLayout'
import { CardsLoadFailed, CardsLoading } from './CardsLoadState'
import { findCard, observedTimeLabel } from './handoverCard'
import { markSafety, type HandoverCard } from './handoverCardApi'
import { HandoverCardBody } from './HandoverCardBody'
import { useCardCacheUpdate, useHandoverCards } from './useHandoverCards'

/**
 * 유저플로우 "새 플로우 3" n21 · n22 — 인계 카드 상세.
 *
 * 목록(n20)에서도 들어오고, 관리자 하원 미처리 브리핑에서도 들어온다. 브리핑 쪽 경로는 유저플로우
 * "AI 인계 도구 내비게이션 맵"의 n46 인계 카드로 이동 → n18 인계 카드 상세 화면이며, 이 화면을 가리키는
 * 같은 노드의 다른 번호다. 들어오는 문이 둘이라 진입 역할로 막지 않는다. (`routes/AppRoutes.tsx`)
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
    <PageLayout title="인계 카드 상세" backTo="/handover-cards" backLabel="목록으로">
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

          {/* 안전 표시는 상세에서 바로 켜고 끈다. 카드를 고칠 일이 없어도 눌러야 하는 조작이다 */}
          <SafetyToggle card={card} />

          {/* n21 → n25. 어르신을 가리지 못한 카드도 여기서 지정해 확정한다 */}
          <Link
            to={`/handover-cards/${card.id}/edit`}
            className="block rounded-2xl border-2 border-slate-300 bg-white px-6 py-5 text-center text-2xl font-semibold text-slate-900 hover:border-teal-600 hover:bg-teal-50"
          >
            카드 검토·수정하기
          </Link>

          {card.careRecipientId !== null && card.nextAction !== null && (
            <Link
              to={`/handover-cards/${card.id}/tasks/new`}
              className="block rounded-2xl bg-teal-700 px-6 py-5 text-center text-2xl font-semibold text-white hover:bg-teal-800"
            >
              다음 행동을 후속 업무로 배정하기
            </Link>
          )}

          <ExportEntry card={card} />
        </>
      )}
    </PageLayout>
  )
}

/**
 * 안전 관련 직접 표시. (Manyfast F-SNBVHR rules)
 *
 * 검토·수정 화면에도 같은 조작이 있지만, 여기에도 둔다. 카드 내용은 그대로 두고 안전 표시만 켜는
 * 일이 흔한데 그때마다 수정 화면을 거치게 하면 고칠 생각이 없던 항목 옆에 커서를 놓게 된다.
 *
 * 판정 출처(`STAFF` · `KEYWORD`)는 화면이 정하지 않는다. 서버가 응답으로 돌려주는 것을 그대로 쓴다.
 */
function SafetyToggle({ card }: { card: HandoverCard }) {
  const applyCard = useCardCacheUpdate()
  const toggle = useMutation({
    mutationFn: (safetyRelated: boolean) => markSafety(card.id, safetyRelated),
    onSuccess: applyCard,
  })

  return (
    <div className="flex flex-col gap-3">
      <BigButton
        tone="plain"
        selected={card.safetyRelated}
        onClick={() => toggle.mutate(!card.safetyRelated)}
      >
        {toggle.isPending
          ? '바꾸는 중…'
          : card.safetyRelated
            ? '안전 관련 표시 해제하기'
            : '안전 관련으로 표시하기'}
      </BigButton>
      {toggle.isError && (
        <p role="alert" className="text-xl text-amber-900">
          {toggle.error instanceof ApiError
            ? toggle.error.message
            : '안전 표시를 바꾸지 못했습니다. 잠시 뒤 다시 눌러 주세요.'}
        </p>
      )}
    </div>
  )
}

/**
 * n21 → n38 문구 생성 선택 → n39 기록·보호자 문구 화면.
 *
 * 열고 닫는 판정을 화면이 하지 않는다. `exportAllowed` 는 문구 생성 API 와 **같은 판정**
 * (`HandoverCard.canGenerateExport()`)에서 나온 서버의 답이고, 막힌 이유도 서버가 문장으로 준다.
 * 조건이 화면과 서버 두 군데에 있으면 한쪽만 고쳐진 채로 검토되지 않은 내용이 보호자에게 나갈 수 있다.
 *
 * 문구 화면 자체는 #18 이다. 그 화면이 붙기 전까지 이 링크를 누르면 갈 곳이 없다.
 */
function ExportEntry({ card }: { card: HandoverCard }) {
  if (!card.exportAllowed) {
    return (
      <p className="text-lg text-slate-500">
        {card.exportBlockedReason ?? '아직 문구를 만들 수 없습니다.'}
      </p>
    )
  }

  return (
    <Link
      to={`/handover-cards/${card.id}/export`}
      className="block rounded-2xl bg-teal-700 px-6 py-5 text-center text-2xl font-semibold text-white hover:bg-teal-800"
    >
      기록·보호자 전달 문구 만들기
    </Link>
  )
}
