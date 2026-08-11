import { Navigate, Outlet } from 'react-router'
import { homePathOf, type EntryRole } from '../features/session/entryRole'
import { useSession } from '../features/session/sessionContext'

/**
 * 진입 선택을 아직 안 했으면 선택 화면으로 되돌린다. (유저플로우 n1 → n2)
 *
 * 권한 검사가 아니다. MVP에는 권한 모델이 없다.
 * `role`을 주면 n3 분기대로 그 역할의 홈만 보여 주고, 다른 역할이 주소로 직접 들어오면
 * 자기 홈으로 보낸다.
 */
export function RequireSession({ role }: { role?: EntryRole }) {
  const { session } = useSession()

  if (!session) {
    return <Navigate to="/" replace />
  }

  if (role && session.entryRole !== role) {
    return <Navigate to={homePathOf(session.entryRole)} replace />
  }

  return <Outlet />
}
