import { isEntryRole, type EntryRole } from './entryRole'
import { findStaffByCode, type Staff } from './staffDirectory'

/**
 * 진입 시 고른 값. 로그인이 아니라 **입력자 식별**이다. 비밀번호를 받지 않는다.
 * 이후 화면은 이 값을 입력자(`reporterName`)로 쓴다.
 */
export type EntrySession = {
  entryRole: EntryRole
  staff: Staff
}

/** 저장 형식이 바뀌면 뒤의 번호를 올려 옛 값과 섞이지 않게 한다. */
export const STORAGE_KEY = 'ieobom.entry-session.v1'

/** 저장은 사번만 한다. 이름은 명단에서 다시 찾아 쓴다. */
type StoredSession = {
  entryRole: string
  staffCode: string
}

/**
 * 브라우저 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 앱은 떠야 한다.
 * 저장이 안 되면 선택값이 새로고침 때 사라질 뿐, 진입 자체를 막지는 않는다.
 */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function loadSession(): EntrySession | null {
  const raw = readRaw()
  if (!raw) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearSession()
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) {
    clearSession()
    return null
  }

  const { entryRole, staffCode } = parsed as Partial<StoredSession>
  const staff = findStaffByCode(staffCode)
  // 명단이나 역할 값이 바뀌어 더는 맞지 않는 저장값이면 버리고 다시 고르게 한다.
  if (!isEntryRole(entryRole) || !staff) {
    clearSession()
    return null
  }

  return { entryRole, staff }
}

export function saveSession(session: EntrySession): void {
  const stored: StoredSession = {
    entryRole: session.entryRole,
    staffCode: session.staff.code,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // 저장 실패는 진입을 막지 않는다.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 지우지 못해도 화면 상태는 이미 비워진 뒤다.
  }
}
