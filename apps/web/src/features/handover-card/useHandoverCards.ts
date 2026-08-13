import { useQuery, useQueryClient } from '@tanstack/react-query'
import { withUpdatedCard } from './handoverCard'
import { fetchHandoverCards, type HandoverCard, type HandoverCardList } from './handoverCardApi'

/** 목록·상세·검토 필요 항목 화면이 함께 쓰는 캐시 키. */
export const HANDOVER_CARDS_KEY = ['handover-cards', 'today'] as const

/**
 * 당일 카드 전체.
 *
 * 카드 단건 조회 API 는 없다. 상세 화면은 이 목록에서 `id` 로 찾는다. 하루치가 어르신 20~30명
 * 규모라 응답이 작고, 목록에서 카드를 골라 들어가는 경로(유저플로우 n20 → n21)에서는
 * 받아 둔 캐시가 바로 그려진다. 최신 확인은 그 뒤에서 따로 돈다.
 */
export function useHandoverCards() {
  return useQuery({ queryKey: HANDOVER_CARDS_KEY, queryFn: () => fetchHandoverCards() })
}

/**
 * 수정·검토 상태 전환·안전 표시의 응답 카드를 목록 캐시에 반영한다.
 *
 * 다시 받아 오지 않는다. 세 API 모두 **고쳐진 카드 한 장을 그대로 돌려주고**(계약) 나머지 카드는
 * 건드리지 않으므로, 그 한 장만 갈아 끼우면 목록·상세·검토 필요 항목이 함께 최신이 된다.
 * 재조회를 걸면 저장 직후 화면이 잠깐 옛 내용으로 되돌아갔다가 바뀐다.
 */
export function useCardCacheUpdate() {
  const queryClient = useQueryClient()

  return (card: HandoverCard) => {
    queryClient.setQueryData<HandoverCardList>(HANDOVER_CARDS_KEY, (list) =>
      list === undefined ? list : withUpdatedCard(list, card),
    )
  }
}
