import type { HandoverCard, HandoverCardList, JobRole } from './handoverCardApi'

/**
 * 카드를 화면에 그리는 규칙.
 *
 * 판정은 하지 않는다. 안전 여부·검토 상태·문구 생성 가능 여부는 모두 서버가 정해서 내려주고
 * 여기서는 그 값을 어떻게 보여 줄지만 정한다. (`docs/contracts/handover-card-schema.md`)
 */

export const JOB_ROLE_LABELS: Record<JobRole, string> = {
  CAREGIVER: '요양보호사',
  NURSE_AIDE: '간호조무사',
  SOCIAL_WORKER: '사회복지사',
  DRIVER: '운전원',
  CENTER_HEAD: '센터장',
}

export function jobRoleLabel(role: JobRole | null): string | null {
  return role === null ? null : JOB_ROLE_LABELS[role]
}

/** 카드가 담는 세 가지. 라벨을 고정해 두고 목록·상세가 같은 이름으로 부른다. */
export const CARD_ENTRY_LABELS = {
  statusChange: '상태 변화',
  actionTaken: '조치',
  nextAction: '다음 행동',
} as const

export type CardEntry = {
  key: keyof typeof CARD_ENTRY_LABELS
  label: string
  value: string | null
}

/**
 * 세 항목을 **값이 없어도 모두** 돌려준다.
 *
 * 빈 항목을 감추면 "조치를 아직 안 했다"와 "조치 칸이 원래 없다"가 화면에서 같아 보인다.
 * 다음 근무자가 알아야 하는 건 남은 다음 행동이 있는지이므로, 없는 것도 없다고 보여 준다.
 * (Manyfast F-SNBVHR display — 상태 변화 · 조치 · 다음 행동을 구분해 표시)
 */
export function cardEntries(card: HandoverCard): CardEntry[] {
  return [
    { key: 'statusChange', label: CARD_ENTRY_LABELS.statusChange, value: card.statusChange },
    { key: 'actionTaken', label: CARD_ENTRY_LABELS.actionTaken, value: card.actionTaken },
    { key: 'nextAction', label: CARD_ENTRY_LABELS.nextAction, value: card.nextAction },
  ]
}

/**
 * 안전 관련 항목을 앞으로 보낸다.
 *
 * 서버도 같은 순서로 내려주지만(계약), 우선 배치는 **화면 요구**라서 화면이 스스로 지킨다.
 * 안전 여부를 다시 계산하는 게 아니라 서버가 준 `safetyRelated` 로 순서만 잡는 것이고,
 * 같은 무게면 받은 순서를 그대로 둔다.
 */
export function safetyFirst(cards: readonly HandoverCard[]): HandoverCard[] {
  return [...cards].sort((a, b) => Number(b.safetyRelated) - Number(a.safetyRelated))
}

/** 관찰 시각을 `HH:MM` 으로. 원문에서 시각을 읽지 못한 카드는 `null` 이다. */
export function observedTimeLabel(observedAt: string | null): string | null {
  if (observedAt === null) {
    return null
  }
  const matched = /T(\d{2}:\d{2})/.exec(observedAt)
  return matched === null ? null : matched[1]
}

/**
 * 다음 행동에 붙은 제안값 한 줄.
 *
 * 제안 직종·기한은 다음 행동에 붙는 값이라 다음 행동이 없으면 나오지 않는다.
 * 직종을 판단할 근거가 부족하면 서버가 비워서 내려주므로, 비어 있으면 비어 있다고 적는다.
 */
export function suggestionLabel(card: HandoverCard): string | null {
  if (card.nextAction === null) {
    return null
  }
  const role = jobRoleLabel(card.suggestedJobRole) ?? '담당 직종 미정'
  const due = card.suggestedDueTime === null ? '기한 미정' : `${card.suggestedDueTime}까지`
  return `제안 · ${role} · ${due}`
}

/** 목록 응답 어디에 있든 카드 하나를 찾는다. 어르신을 가리지 못한 카드도 상세로 열 수 있어야 한다. */
export function findCard(list: HandoverCardList, cardId: number): HandoverCard | null {
  for (const recipient of list.recipients) {
    const found = recipient.cards.find((card) => card.id === cardId)
    if (found !== undefined) {
      return found
    }
  }
  return list.unresolved.find((card) => card.id === cardId) ?? null
}

export function totalCardCount(list: HandoverCardList): number {
  return (
    list.recipients.reduce((sum, recipient) => sum + recipient.cards.length, 0) +
    list.unresolved.length
  )
}

/** `2026-08-11` 을 `8월 11일` 로. 어느 날 것을 보고 있는지만 알면 된다. */
export function dateLabel(date: string): string {
  const matched = /^\d{4}-(\d{2})-(\d{2})$/.exec(date)
  if (matched === null) {
    return date
  }
  return `${Number(matched[1])}월 ${Number(matched[2])}일`
}
