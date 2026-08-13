import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, loadSession, saveSession, STORAGE_KEY } from './sessionStorage'
import { STAFF_CACHE_KEY } from './staffDirectory'
import { seedStaffCache, TEST_STAFF } from './staffFixture'

const 김하늘 = TEST_STAFF[0]

// 이름은 저장하지 않고 명단에서 다시 찾으므로, 되살리려면 명단을 받아 둔 상태여야 한다.
beforeEach(() => {
  seedStaffCache()
})

describe('진입 선택값 저장', () => {
  it('저장한 역할과 본인을 그대로 되살린다', () => {
    saveSession({ entryRole: 'FIELD_WORKER', staff: 김하늘 })

    expect(loadSession()).toEqual({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
  })

  it('이름이 아니라 사번으로 저장한다', () => {
    saveSession({ entryRole: 'MANAGER', staff: 김하늘 })

    // 명단에서 이름이 바뀌어도 저장값을 고칠 필요가 없어야 한다.
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      entryRole: 'MANAGER',
      staffCode: 김하늘.code,
    })
  })

  it('명단에 없는 사번이면 버리고 다시 고르게 한다', () => {
    saveSession({ entryRole: 'FIELD_WORKER', staff: { code: 'ST-999', name: '퇴사한 직원' } })

    expect(loadSession()).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('명단에서 이름이 바뀌면 바뀐 이름으로 되살린다', () => {
    saveSession({ entryRole: 'FIELD_WORKER', staff: 김하늘 })
    seedStaffCache([{ code: 김하늘.code, name: '김하늘(개명)' }])

    // 이름을 함께 저장했다면 옛 이름이 입력자로 계속 남았을 것이다.
    expect(loadSession()?.staff.name).toBe('김하늘(개명)')
  })

  it('명단을 아직 한 번도 받지 못했으면 되살리지 않는다', () => {
    saveSession({ entryRole: 'MANAGER', staff: 김하늘 })
    window.localStorage.removeItem(STAFF_CACHE_KEY)

    expect(loadSession()).toBeNull()
  })

  it('진입 역할이 아닌 값이 들어 있으면 버린다', () => {
    // 담당 직종이 저장돼 있던 옛 값이 남아 있어도 그대로 들여보내지 않는다.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ entryRole: '요양보호사', staffCode: 김하늘.code }),
    )

    expect(loadSession()).toBeNull()
  })

  it('읽을 수 없는 값이면 버린다', () => {
    window.localStorage.setItem(STORAGE_KEY, '{깨진 값')

    expect(loadSession()).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('아무것도 고르지 않았으면 비어 있다', () => {
    expect(loadSession()).toBeNull()
  })

  it('선택을 지우면 남지 않는다', () => {
    saveSession({ entryRole: 'MANAGER', staff: 김하늘 })
    clearSession()

    expect(loadSession()).toBeNull()
  })
})
