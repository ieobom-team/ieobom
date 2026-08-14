import { apiFetch } from '../../shared/api/client'
import { cacheDirectory, readCachedDirectory, type Staff } from './staffDirectory'

/** 계약은 `docs/contracts/handover-api.md` 에 있다. */

type StaffListResponse = {
  staff: Staff[]
}

/**
 * 직원 명단을 받아 온다.
 *
 * **연결이 끊겨도 진입을 막지 않는다.** 받아 오지 못하면 마지막으로 캐시해 둔 명단으로 본인을 고르게 한다.
 * 명단은 하루에도 몇 번씩 바뀌는 값이 아니고, 여기서 막으면 현장 근무자가 입력 자체를 못 한다.
 * 캐시까지 비어 있을 때만 오류로 올린다 — 그때는 보여 줄 이름이 하나도 없다.
 */
export async function fetchStaffDirectory(): Promise<Staff[]> {
  try {
    const response = await apiFetch<StaffListResponse>('/api/staff')
    cacheDirectory(response.staff)
    return response.staff
  } catch (error) {
    const cached = readCachedDirectory()
    if (cached.length === 0) {
      throw error
    }
    return cached
  }
}
