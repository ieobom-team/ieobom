import type { ApiFieldError } from '../../shared/api/client'
import type { HandoverCard, JobRole } from '../handover-card/handoverCardApi'
import type { TaskCreateRequest } from './taskApi'

/**
 * 배정 화면(n27)의 폼 상태와 제출 전 검증.
 *
 * **빈 입력으로 시작하지 않는다.** (Manyfast F-IVFNPC display) 카드가 이미 들고 있는 제안값
 * (`nextAction` · `suggestedJobRole` · `suggestedDueTime`)으로 채운 뒤, 직원이 그대로 확정하거나
 * 고쳐서 보낸다. 서버는 빈 칸을 카드 값으로 다시 메우지 않으므로(`docs/contracts/task-api.md`),
 * 화면이 프리필을 만들지 못하면 그 사실이 그대로 빈 칸으로 드러나야 한다.
 */

export type TaskDraft = {
  content: string
  assigneeJobRole: JobRole | null
  assigneeName: string
  /** `<input type="time">` 값. `HH:MM` */
  dueTime: string
}

export const TASK_FIELD_LABELS: Record<string, string> = {
  content: '다음 행동',
  assigneeJobRole: '담당',
  assigneeName: '담당',
  dueTime: '기한',
}

export function taskFieldLabel(field: string): string {
  return TASK_FIELD_LABELS[field] ?? field
}

export function draftFromCard(card: HandoverCard): TaskDraft {
  return {
    content: card.nextAction ?? '',
    assigneeJobRole: card.suggestedJobRole,
    assigneeName: '',
    dueTime: card.suggestedDueTime ?? '',
  }
}

/**
 * 보완할 항목을 한 번에 모아 돌려준다. (Manyfast F-IVFNPC exceptions, n30 negative → n27)
 *
 * 담당은 직종과 이름 중 하나만 있으면 되므로, 둘 다 비어야만 담당을 지목한다.
 */
export function validateTaskDraft(draft: TaskDraft): ApiFieldError[] {
  const errors: ApiFieldError[] = []

  if (draft.content.trim() === '') {
    errors.push({ field: 'content', reason: '다음 행동을 남겨 주세요.' })
  }

  if (draft.assigneeJobRole === null && draft.assigneeName.trim() === '') {
    errors.push({
      field: 'assigneeJobRole',
      reason: '담당 직종 또는 담당자 이름 중 하나는 지정해 주세요.',
    })
  }

  if (draft.dueTime.trim() === '') {
    errors.push({ field: 'dueTime', reason: '기한을 지정해 주세요.' })
  }

  return errors
}

export function toTaskCreateRequest(draft: TaskDraft): TaskCreateRequest {
  const request: TaskCreateRequest = {
    content: draft.content.trim(),
    dueTime: draft.dueTime,
  }
  if (draft.assigneeJobRole !== null) {
    request.assigneeJobRole = draft.assigneeJobRole
  }
  if (draft.assigneeName.trim() !== '') {
    request.assigneeName = draft.assigneeName.trim()
  }
  return request
}
