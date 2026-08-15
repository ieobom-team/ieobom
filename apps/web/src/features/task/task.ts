import { jobRoleLabel } from '../handover-card/handoverCard'
import type { TaskResponse } from './taskApi'

/**
 * 업무를 화면에 그리는 규칙.
 *
 * 판정은 하지 않는다. 상태·대리 완료 여부는 서버가 정해서 내려주고 여기서는 그 값을 어떻게
 * 보여 줄지만 정한다. (`docs/contracts/task-api.md`)
 */

/** 담당 직종·이름 중 있는 것을 한 줄로. 담당은 직종 또는 이름 중 하나만 있어도 된다. */
export function assigneeLabel(task: TaskResponse): string {
  if (task.assigneeName !== null && task.assigneeJobRoleLabel !== null) {
    return `${task.assigneeName} (${task.assigneeJobRoleLabel})`
  }
  if (task.assigneeName !== null) {
    return task.assigneeName
  }
  if (task.assigneeJobRoleLabel !== null) {
    return task.assigneeJobRoleLabel
  }
  return jobRoleLabel(task.assigneeJobRole) ?? '담당 미정'
}

/** 기한은 날짜 없이 항상 시각까지. (Manyfast F-IVFNPC display) */
export function dueTimeLabel(task: TaskResponse): string {
  return `${task.dueTime}까지`
}

/**
 * 담당이 직종만 정해졌는지, 사람까지 정해졌는지. (Manyfast F-IVFNPC display — "직종만 배정, 담당자 확정 두 가지를 구분한다")
 */
export function claimStatusLabel(task: TaskResponse): '직종만 배정' | '담당자 확정' {
  return task.assigneeName === null ? '직종만 배정' : '담당자 확정'
}

/**
 * 담당이 정해진 지 얼마나 지났는지. ("이준호님이 N분 전에 맡았습니다")
 *
 * 서버 안내 문구(`notice`)는 상대 시각을 담지 않으므로 `claimedAt` 으로 화면에서 직접 계산한다.
 * Manyfast 는 정확한 문구를 규정하지 않아 1분 미만은 "방금 전"으로 둔다.
 */
export function claimedAgoLabel(claimedAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(claimedAt).getTime()) / 60000))
  return minutes < 1 ? '방금 전' : `${minutes}분 전`
}

/**
 * 완료 처리 결과 한 줄. 대리 완료 여부와 확인자를 함께 보여 준다. (Manyfast F-IVFNPC display)
 *
 * 직종만 배정된 업무는 대리 완료를 판정할 근거가 없어 거짓으로 내려온다 — 확인자 이름만 보여 준다.
 */
export function completionLabel(task: TaskResponse): string | null {
  if (task.status !== 'DONE' || task.completedByName === null) {
    return null
  }
  return task.delegated
    ? `${task.completedByName} 님이 대리 완료 처리`
    : `${task.completedByName} 님이 완료 처리`
}
