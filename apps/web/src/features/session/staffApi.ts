import { apiFetch, apiUrl, ApiError, NETWORK_UNAVAILABLE } from '../../shared/api/client'
import {
  cacheDirectory,
  readCachedDirectory,
  updateCachedStaff,
  type Staff,
} from './staffDirectory'

/** 계약은 `docs/contracts/handover-api.md` 에 있다. */

type StaffListResponse = {
  staff: Staff[]
}

export type VerifyPinResult = {
  valid: boolean
  locked: boolean
  remainingAttempts: number
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

/**
 * 직원 4~6자리 숫자 PIN 일치 여부를 검증한다. (Manyfast F-YJJJUX, #83, #84)
 * 5회 실패 시 1분간 잠김(423 Locked).
 */
export async function verifyStaffPin(code: string, pin: string): Promise<VerifyPinResult> {
  let response: Response
  try {
    response = await fetch(apiUrl(`/api/staff/${encodeURIComponent(code)}/verify-pin`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
  } catch {
    throw new ApiError(
      NETWORK_UNAVAILABLE,
      '연결이 끊겨 PIN 검증을 하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      [],
      0,
    )
  }

  if (response.status === 200 || response.status === 423) {
    const data = (await response.json()) as VerifyPinResult
    return data
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // ignore json parse error
  }
  const parsed = (body ?? {}) as Partial<{ code: string; message: string }>
  throw new ApiError(
    parsed.code ?? 'UNKNOWN_ERROR',
    parsed.message ?? 'PIN 검증 중 오류가 발생했습니다.',
    [],
    response.status,
  )
}

/**
 * 직원의 4~6자리 숫자 PIN을 신규 등록, 변경하거나 해제한다. (Manyfast F-YJJJUX, #83, #84)
 * newPin이 빈 값이면 해제.
 */
export async function updateStaffPin(
  code: string,
  currentPin?: string,
  newPin?: string,
): Promise<Staff> {
  const response = await apiFetch<Staff>(`/api/staff/${encodeURIComponent(code)}/pin`, {
    method: 'PUT',
    body: JSON.stringify({ currentPin, newPin }),
  })
  updateCachedStaff(response)
  return response
}

/**
 * 관리자 1-Click 직원 PIN 즉시 초기화(해제). (Manyfast F-YJJJUX exceptions, #83, #84)
 */
export async function resetStaffPin(code: string): Promise<Staff> {
  const response = await apiFetch<Staff>(`/api/staff/${encodeURIComponent(code)}/reset-pin`, {
    method: 'POST',
  })
  updateCachedStaff(response)
  return response
}
