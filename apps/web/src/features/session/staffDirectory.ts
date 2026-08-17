import type { JobRole } from '../handover-card/handoverCardApi'

/**
 * 직원 명단 — 본인 식별 및 업무 배정 담당자 선택에 쓰는 목록.
 *
 * **명단은 서버가 관리한다.** (`GET /api/staff`, #33) 화면은 받아 온 명단을 기기에 캐시해 두고,
 * 저장된 선택값(사번)을 되살릴 때 이 캐시에서 이름을 다시 찾는다.
 * (Manyfast F-YJJJUX permissions, F-IVFNPC display)
 */
export type Staff = {
  /** 사번. 명단 안에서 유일하며 저장된 선택값을 되살릴 때 이 값을 쓴다. */
  code: string
  name: string
  /** 담당 직종. 후속 업무 배정 시 직종별 필터링에 쓴다. */
  jobRole?: JobRole
  jobRoleLabel?: string
  /** 선택형 4~6자리 숫자 PIN 설정 여부 (Manyfast F-YJJJUX, #83, #84) */
  hasPin?: boolean
}

/** 캐시 형식이 바뀌면 뒤의 번호를 올려 옛 값과 섞이지 않게 한다. */
export const STAFF_CACHE_KEY = 'ieobom.staff-directory.v3'

function isStaff(value: unknown): value is Staff {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Staff).code === 'string' &&
    typeof (value as Staff).name === 'string'
  )
}

/**
 * 마지막으로 받아 둔 명단.
 *
 * 브라우저 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 빈 목록이 된다.
 * 이때는 명단을 받아 오기 전까지 본인을 고를 수 없을 뿐, 앱이 뜨지 않는 것은 아니다.
 */
export function readCachedDirectory(): Staff[] {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STAFF_CACHE_KEY)
  } catch {
    return []
  }
  if (raw === null) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isStaff) : []
  } catch {
    return []
  }
}

export function cacheDirectory(directory: readonly Staff[]): void {
  try {
    window.localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(directory))
  } catch {
    // 캐시하지 못해도 이번 화면은 받아 온 목록으로 그대로 동작한다.
  }
}

export function updateCachedStaff(updatedStaff: Staff): void {
  const current = readCachedDirectory()
  const next = current.map((s) => (s.code === updatedStaff.code ? updatedStaff : s))
  cacheDirectory(next)
}

export function findStaffByCode(
  directory: readonly Staff[],
  code: string | null | undefined,
): Staff | undefined {
  if (!code) {
    return undefined
  }
  return directory.find((staff) => staff.code === code)
}
