import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchStaffDirectory } from './staffApi'
import { readCachedDirectory } from './staffDirectory'
import { seedStaffCache, TEST_STAFF } from './staffFixture'

const 서버_명단 = [
  { code: 'ST-001', name: '김하늘' },
  { code: 'ST-003', name: '박서연' },
]

function 명단_응답() {
  return new Response(JSON.stringify({ staff: 서버_명단 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(명단_응답())))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('직원 명단 조회', () => {
  it('받아 온 명단을 기기에 캐시해 둔다', async () => {
    await expect(fetchStaffDirectory()).resolves.toEqual(서버_명단)

    expect(readCachedDirectory()).toEqual(서버_명단)
  })

  it('연결이 끊기면 마지막으로 받아 둔 명단으로 고르게 한다', async () => {
    // 명단을 못 받았다고 진입을 막으면 현장 근무자가 입력 자체를 못 한다.
    seedStaffCache()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))

    await expect(fetchStaffDirectory()).resolves.toEqual(TEST_STAFF)
  })

  it('캐시까지 비어 있으면 오류로 알린다', async () => {
    // 보여 줄 이름이 하나도 없다. 빈 목록으로 조용히 넘기면 고를 게 없는 화면이 된다.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))

    await expect(fetchStaffDirectory()).rejects.toThrow()
  })

  it('캐시를 새 명단으로 갈아 끼운다', async () => {
    seedStaffCache()

    await fetchStaffDirectory()

    // 퇴사해서 빠진 사람이 캐시에 남아 있으면 안 된다.
    expect(readCachedDirectory()).toEqual(서버_명단)
  })
})
