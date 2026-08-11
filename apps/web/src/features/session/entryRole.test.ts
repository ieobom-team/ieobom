import { describe, expect, it } from 'vitest'
import { ENTRY_ROLES, homePathOf, isEntryRole } from './entryRole'

describe('진입 역할', () => {
  it('현장 근무자와 관리자·센터장 2종만 있다', () => {
    // 담당 직종 5종이 여기 섞여 들어오는 것을 막는 것이 이 화면의 핵심이다.
    expect(ENTRY_ROLES.map((role) => role.label)).toEqual(['현장 근무자', '관리자·센터장'])
  })

  it('역할마다 갈 홈이 다르다', () => {
    expect(homePathOf('FIELD_WORKER')).toBe('/field')
    expect(homePathOf('MANAGER')).toBe('/admin')
  })

  it('담당 직종 이름은 진입 역할로 인정하지 않는다', () => {
    expect(isEntryRole('FIELD_WORKER')).toBe(true)
    expect(isEntryRole('요양보호사')).toBe(false)
    expect(isEntryRole(undefined)).toBe(false)
  })
})
