import type { ComponentType } from 'react'
import { CheckSquare, ClipboardList, House, type LucideProps } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useSession } from '../../features/session/sessionContext'

export type NavItem = {
  path: string
  label: string
  Icon: ComponentType<LucideProps>
  matchPrefix?: boolean
}

const FIELD_NAV_ITEMS: NavItem[] = [
  { path: '/field', label: '현장 홈', Icon: House },
  { path: '/handover-cards', label: '인계 카드', Icon: ClipboardList, matchPrefix: true },
  { path: '/tasks', label: '오늘의 업무', Icon: CheckSquare, matchPrefix: true },
]

/**
 * 현장 모바일 환경에서 한 손 조작을 돕는 하단 탭바.
 *
 * - 50~60대 현장 근무자의 시인성을 위해 또렷한 굵은 라인(2.3px)의 SVG 벡터 아이콘과 큰 라벨을 제공한다.
 * - [현장 홈] [인계 카드] [오늘의 업무]
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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-divider bg-surface-modal/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto flex h-18 max-w-2xl items-center justify-around px-2">
        {items.map((item) => {
          const active = isActive(item)
          const Icon = item.Icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                active ? 'font-bold text-primary' : 'font-medium text-ink-muted hover:text-ink'
              }`}
            >
              <span className="flex items-center justify-center" aria-hidden="true">
                <Icon
                  size={26}
                  strokeWidth={active ? 2.5 : 2.2}
                  className={active ? 'text-primary' : 'text-ink-muted'}
                />
              </span>
              <span
                className={`mt-1 text-xs font-semibold sm:text-sm ${
                  active ? 'text-primary' : 'text-ink-muted'
                }`}
              >
                {item.label}
              </span>
              {active && <span className="mt-0.5 h-1 w-6 rounded-full bg-primary" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
