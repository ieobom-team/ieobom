import type { ApiFieldError } from '../../shared/api/client'
import type { HandoverCard, HandoverCardUpdateRequest, JobRole } from './handoverCardApi'

/**
 * 검토·수정 화면(n25)의 폼 상태와 제출 전 검증.
 *
 * 카드가 이미 들고 있는 값으로 채워 두고 직원이 고친다. AI 결과를 지우고 처음부터 쓰게 하는 화면이
 * 아니라 **고칠 곳만 고치는** 화면이다. (Manyfast F-SNBVHR action — 사용자는 정리 결과를 검토하고 수정한다)
 *
 * 여기 검증은 서버 검증을 대신하지 않고 같은 기준을 화면에서 먼저 잡을 뿐이다. 규칙의 주인은 서버이고
 * (`docs/contracts/handover-card-schema.md`), 화면은 저장 버튼을 누르기 전에 같은 말을 해 준다.
 */

export type CardEditDraft = {
  /** 아직 누구 이야기인지 가리지 못했으면 `null` */
  careRecipientId: number | null
  statusChange: string
  actionTaken: string
  nextAction: string
  suggestedJobRole: JobRole | null
  /** `<input type="time">` 값. `HH:MM` */
  suggestedDueTime: string
}

export const CARD_FIELD_LABELS: Record<string, string> = {
  careRecipientId: '대상 어르신',
  statusChange: '상태 변화',
  actionTaken: '조치',
  nextAction: '다음 행동',
  suggestedJobRole: '제안 담당 직종',
  suggestedDueTime: '제안 기한',
}

export function cardFieldLabel(field: string): string {
  return CARD_FIELD_LABELS[field] ?? field
}

export function cardDraftFrom(card: HandoverCard): CardEditDraft {
  return {
    careRecipientId: card.careRecipientId,
    statusChange: card.statusChange ?? '',
    actionTaken: card.actionTaken ?? '',
    nextAction: card.nextAction ?? '',
    suggestedJobRole: card.suggestedJobRole,
    suggestedDueTime: card.suggestedDueTime ?? '',
  }
}

/**
 * 보완할 항목을 한 번에 모아 돌려준다.
 *
 * 세 항목이 모두 비면 근거만 있고 아무 말도 하지 않는 카드가 된다. 카드 삭제가 없는 지금은 그 카드가
 * 목록에 영원히 남으므로, 서버와 같은 기준으로 막는다. 어느 한 칸만 지목하지 않고 셋을 모두 지목하는
 * 것도 서버와 같다 — 셋 중 어디에 써도 되기 때문이다.
 */
export function validateCardDraft(draft: CardEditDraft): ApiFieldError[] {
  const errors: ApiFieldError[] = []
  const nextAction = draft.nextAction.trim()

  if (draft.statusChange.trim() === '' && draft.actionTaken.trim() === '' && nextAction === '') {
    const reason = '상태 변화 · 조치 · 다음 행동 중 하나는 남겨 주세요.'
    errors.push(
      { field: 'statusChange', reason },
      { field: 'actionTaken', reason },
      { field: 'nextAction', reason },
    )
  }

  if (
    nextAction === '' &&
    (draft.suggestedJobRole !== null || draft.suggestedDueTime.trim() !== '')
  ) {
    errors.push({
      field: 'nextAction',
      reason: '제안 직종과 기한은 다음 행동이 있을 때만 지정할 수 있습니다.',
    })
  }

  return errors
}

/** 공백만 남은 칸은 지운 것으로 본다. 서버도 같은 기준으로 다듬는다. */
function trimToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function toCardUpdateRequest(draft: CardEditDraft): HandoverCardUpdateRequest {
  return {
    careRecipientId: draft.careRecipientId,
    statusChange: trimToNull(draft.statusChange),
    actionTaken: trimToNull(draft.actionTaken),
    nextAction: trimToNull(draft.nextAction),
    suggestedJobRole: draft.suggestedJobRole,
    suggestedDueTime: trimToNull(draft.suggestedDueTime),
  }
}
