import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { EntryRole } from './entryRole'
import type { Staff } from './staffDirectory'
import { SessionContext, type SessionContextValue } from './sessionContext'
import { clearSession, loadSession, saveSession, type EntrySession } from './sessionStorage'
import {
  syncPushSubscriptionOnSessionEnter,
  syncPushSubscriptionOnSessionLeave,
} from '../notification/push/usePushSubscription'

export function SessionProvider({ children }: { children: ReactNode }) {
  // 새로고침해도 선택이 유지되도록 첫 렌더에서 저장값을 되살린다.
  const [session, setSession] = useState<EntrySession | null>(() => loadSession())

  const enter = useCallback((entryRole: EntryRole, staff: Staff) => {
    const next: EntrySession = { entryRole, staff }
    saveSession(next)
    setSession(next)
    void syncPushSubscriptionOnSessionEnter(staff.code)
  }, [])

  const updateStaff = useCallback((staff: Staff) => {
    setSession((prev) => {
      if (!prev) return null
      const next: EntrySession = { ...prev, staff }
      saveSession(next)
      return next
    })
  }, [])

  const leave = useCallback(() => {
    clearSession()
    setSession(null)
    void syncPushSubscriptionOnSessionLeave()
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({ session, enter, updateStaff, leave }),
    [session, enter, updateStaff, leave],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
