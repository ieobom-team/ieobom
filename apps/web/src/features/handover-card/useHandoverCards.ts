import { useQuery } from '@tanstack/react-query'
import { fetchHandoverCards } from './handoverCardApi'

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
