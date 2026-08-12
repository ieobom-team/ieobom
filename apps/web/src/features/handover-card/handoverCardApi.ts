import { apiFetch } from '../../shared/api/client'

/** 계약은 `docs/contracts/handover-card-schema.md` 에 있다. */

export type ReviewStatus = 'NEEDS_REVIEW' | 'REVIEWED'

/** 안전 관련 판정이 어디서 나왔는지. 안전 항목이 아니면 `null` 이다. */
export type SafetyFlagSource = 'KEYWORD' | 'STAFF'

/** 담당 직종. PRD 역할 목록 5종뿐이고, 판단 근거가 부족하면 서버가 비워서 내려준다. */
export type JobRole = 'CAREGIVER' | 'NURSE_AIDE' | 'SOCIAL_WORKER' | 'DRIVER' | 'CENTER_HEAD'

/**
 * 구조화된 카드 하나.
 *
 * `evidenceText` 만 `null` 이 아니다. 근거 없는 항목은 서버가 저장 단계에서 이미 버렸다.
 * `careRecipientId` 가 `null` 인 카드는 대상 어르신을 가리지 못한 검토 대상이다.
 */
export type HandoverCard = {
  id: number
  handoverId: number
  careRecipientId: number | null
  careRecipientName: string | null
  /** 오프셋 없는 지역 시각. 원문에서 시각을 읽지 못했으면 `null` */
  observedAt: string | null
  statusChange: string | null
  actionTaken: string | null
  nextAction: string | null
  evidenceText: string
  safetyRelated: boolean
  safetyFlagSource: SafetyFlagSource | null
  reviewStatus: ReviewStatus
  suggestedJobRole: JobRole | null
  /** `HH:MM`. 초는 붙지 않는다 */
  suggestedDueTime: string | null
  exportAllowed: boolean
  exportBlockedReason: string | null
  createdAt: string
}

export type RecipientCards = {
  careRecipientId: number
  careRecipientName: string
  cards: HandoverCard[]
}

/**
 * 하루치 카드.
 *
 * `unresolved` 는 대상 어르신을 가리지 못한 항목이라 `recipients` 안에 섞여 오지 않는다.
 * 화면도 섞지 않고 검토 필요 항목 화면(유저플로우 n24)에서 따로 보여 준다.
 */
export type HandoverCardList = {
  date: string
  recipients: RecipientCards[]
  unresolved: HandoverCard[]
}

export type HandoverCardStructureResult = {
  handoverId: number
  createdCount: number
  /** 근거를 원문에서 찾지 못해 버려진 항목 수. 0 이 아닌 것은 오류가 아니다 */
  discardedCount: number
  cards: HandoverCard[]
}

/** `date` 를 생략하면 서버가 오늘로 본다. */
export function fetchHandoverCards(date?: string): Promise<HandoverCardList> {
  return apiFetch<HandoverCardList>(
    date ? `/api/handover-cards?date=${date}` : '/api/handover-cards',
  )
}

/**
 * 저장된 원문을 카드로 구조화한다.
 *
 * 저장(`POST /api/handovers`) 안에서 하지 않고 프론트가 이어서 부르는 이유는 계약 문서에 있다.
 * 현장 입력 저장이 LLM 응답 시간과 실패에 묶이면 돌봄 중인 근무자가 저장 성공을 확인하기까지
 * 수 초를 기다리게 된다. 그래서 **이 호출이 실패해도 저장은 이미 끝나 있다.**
 *
 * 같은 인계를 다시 부르면 서버가 `409` 로 막는다. 재구조화는 제공하지 않는다.
 */
export function structureHandover(handoverId: number): Promise<HandoverCardStructureResult> {
  return apiFetch<HandoverCardStructureResult>(`/api/handovers/${handoverId}/cards`, {
    method: 'POST',
  })
}
