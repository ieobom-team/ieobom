import { createContext, useContext } from 'react'
import type { EntryRole } from './entryRole'
import type { Staff } from './staffDirectory'
import type { EntrySession } from './sessionStorage'

export type SessionContextValue = {
  session: EntrySession | null
  /** 진입 역할과 본인을 확정한다. */
  enter: (entryRole: EntryRole, staff: Staff) => void
  /** 현재 세션의 직원 정보를 갱신한다. (PIN 설정/변경/해제 시) */
  updateStaff: (staff: Staff) => void
  /** 선택을 지우고 진입 선택 화면으로 되돌린다. (본인 바꾸기) */
  leave: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession 은 SessionProvider 안에서만 쓸 수 있습니다.')
  }
  return value
}
