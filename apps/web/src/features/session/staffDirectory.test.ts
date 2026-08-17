import { describe, expect, it } from 'vitest'
import { TEST_STAFF } from './staffFixture'
import {
  cacheDirectory,
  findStaffByCode,
  readCachedDirectory,
  STAFF_CACHE_KEY,
  updateCachedStaff,
} from './staffDirectory'

describe('직원 명단 캐시', () => {
  it('받아 온 명단을 그대로 되살린다', () => {
    cacheDirectory(TEST_STAFF)

    expect(readCachedDirectory()).toEqual(TEST_STAFF)
  })

  it('아직 받아 온 적이 없으면 비어 있다', () => {
    expect(readCachedDirectory()).toEqual([])
  })

  it('읽을 수 없는 값이 들어 있어도 진입을 막지 않는다', () => {
    window.localStorage.setItem(STAFF_CACHE_KEY, '{깨진 값')

    expect(readCachedDirectory()).toEqual([])
  })

  it('updateCachedStaff 로 특정 직원의 정보를 캐시에서 갱신한다', () => {
    cacheDirectory(TEST_STAFF)
    const updated = { ...TEST_STAFF[0], hasPin: false }
    updateCachedStaff(updated)

    expect(findStaffByCode(readCachedDirectory(), 'ST-001')?.hasPin).toBe(false)
  })
})

describe('사번으로 직원 찾기', () => {
  it('명단에 있으면 그 사람을 준다', () => {
    expect(findStaffByCode(TEST_STAFF, 'ST-001')?.name).toBe('김하늘')
  })

  it('명단에 없는 사번이면 찾지 못한다', () => {
    // 퇴사 등으로 명단에서 빠진 사번이다. 저장된 선택값을 되살리면 안 된다.
    expect(findStaffByCode(TEST_STAFF, 'ST-999')).toBeUndefined()
    expect(findStaffByCode(TEST_STAFF, null)).toBeUndefined()
    expect(findStaffByCode([], 'ST-001')).toBeUndefined()
  })
})
