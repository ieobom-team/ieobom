import { describe, expect, it } from 'vitest'
import { findStaffByCode, STAFF_DIRECTORY } from './staffDirectory'

describe('직원 명단', () => {
  it('사번이 겹치지 않는다', () => {
    // 저장된 선택값을 되살릴 때 사번으로 찾으므로 겹치면 다른 사람이 된다.
    const codes = STAFF_DIRECTORY.map((staff) => staff.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('명단에 담당 직종을 두지 않는다', () => {
    // 담당 직종은 업무 배정에만 쓰는 값이다. 여기 들어오면 진입 역할과 섞인다.
    for (const staff of STAFF_DIRECTORY) {
      expect(Object.keys(staff).sort()).toEqual(['code', 'name'])
    }
  })

  it('없는 사번이면 찾지 못한다', () => {
    expect(findStaffByCode('ST-001')?.name).toBe('김하늘')
    expect(findStaffByCode('ST-999')).toBeUndefined()
    expect(findStaffByCode(null)).toBeUndefined()
  })
})
