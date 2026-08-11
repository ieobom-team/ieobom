/**
 * 진입 역할 — 앱에 들어올 때 고르는 값. **어떤 홈을 보여줄지만** 결정한다.
 *
 * 업무 배정에 쓰는 담당 직종(요양보호사·간호조무사·사회복지사·운전원·센터장 5종)과는
 * 다른 개념이므로 이 파일에 담당 직종을 함께 두지 않는다. 담당 직종은 업무 배정 화면에서 고른다.
 */
export type EntryRole = 'FIELD_WORKER' | 'MANAGER'

export type EntryRoleOption = {
  value: EntryRole
  label: string
  /** 선택 화면에서 두 역할이 무엇으로 갈리는지 한 줄로 보여 준다. */
  summary: string
  homePath: string
}

export const ENTRY_ROLES: readonly EntryRoleOption[] = [
  {
    value: 'FIELD_WORKER',
    label: '현장 근무자',
    summary: '돌봄 중 특이사항을 남기고 내 할 일을 확인합니다',
    homePath: '/field',
  },
  {
    value: 'MANAGER',
    label: '관리자·센터장',
    summary: '당일 현황과 미처리 업무를 검토합니다',
    homePath: '/admin',
  },
]

export function isEntryRole(value: unknown): value is EntryRole {
  return ENTRY_ROLES.some((role) => role.value === value)
}

export function findEntryRole(value: EntryRole): EntryRoleOption {
  const found = ENTRY_ROLES.find((role) => role.value === value)
  if (!found) {
    throw new Error(`알 수 없는 진입 역할입니다: ${value}`)
  }
  return found
}

export function homePathOf(value: EntryRole): string {
  return findEntryRole(value).homePath
}
