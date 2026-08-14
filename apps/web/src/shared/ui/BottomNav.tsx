import { Link, useLocation } from 'react-router'
import { useSession } from '../../features/session/sessionContext'

export type NavItem = {
  path: string
  label: string
  icon: string
  matchPrefix?: boolean
}

const FIELD_NAV_ITEMS: NavItem[] = [
  { path: '/field', label: '현장 홈', icon: '🏠' },
  { path: '/handover-cards', label: '인계 카드', icon: '📋', matchPrefix: true },
  { path: '/tasks', label: '오늘의 업무', icon: '✅', matchPrefix: true },
]

/**
 * 현장 모바일 환경에서 한 손 조작을 돕는 하단 탭바.
 *
 * - 현장 근무자: [현장 홈] [인계 카드] [오늘의 업무]
 * - 관리자 화면은 데스크톱 웹 기준이므로 바텀 바를 띄우지 않는다.
 */
export function BottomNav() {
  const { session } = useSession()
  const location = useLocation()

  if (!session || session.entryRole !== 'FIELD_WORKER') {
    return null
  }

  const items = FIELD_NAV_ITEMS

  const isActive = (item: NavItem) => {
    if (item.path === location.pathname) {
      return true
    }
    if (item.matchPrefix && item.path !== '/' && location.pathname.startsWith(item.path)) {
      return true
    }
    return false
  }

  return (
    <nav
      aria-label="하단 빠른 이동"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto flex h-18 max-w-2xl items-center justify-around px-2">
        {items.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                active ? 'font-bold text-teal-800' : 'font-medium text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {item.icon}
              </span>
              <span className={`mt-1 text-xs sm:text-sm ${active ? 'text-teal-800' : 'text-slate-600'}`}>
                {item.label}
              </span>
              {active && <span className="mt-0.5 h-1 w-6 rounded-full bg-teal-600" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
