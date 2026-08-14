import { Link } from 'react-router'
import { findEntryRole, homePathOf } from '../../features/session/entryRole'
import { useSession } from '../../features/session/sessionContext'

export type AppHeaderProps = {
  /** 페이지 제목 (생략 시 로고만 노출) */
  title?: string
  /** 뒤로가기 대상 경로 (예: "/handover-cards") */
  backTo?: string
  /** 뒤로가기 버튼 레이블 (기본값: "이전") */
  backLabel?: string
  /** 뒤로가기 버튼 강제 표시 여부 */
  showBack?: boolean
  /** 뒤로가기 커스텀 클릭 핸들러 */
  onBack?: () => void
  /** 세션 식별 바 표시 여부 (기본값: true) */
  showSession?: boolean
  className?: string
}

/**
 * 전 화면 공통 글로벌 헤더.
 *
 * - 좌측: 뒤로가기 버튼 또는 홈(로고) 링크
 * - 중앙: 페이지 제목
 * - 우측: 현재 로그인한 본인 칩 및 '본인 바꾸기' 버튼
 */
export function AppHeader({
  title,
  backTo,
  backLabel = '이전',
  showBack = false,
  onBack,
  showSession = true,
  className = '',
}: AppHeaderProps) {
  const { session, leave } = useSession()

  const shouldShowBack = showBack || Boolean(backTo) || Boolean(onBack)
  const homePath = session ? homePathOf(session.entryRole) : '/'
  const role = session ? findEntryRole(session.entryRole) : null

  return (
    <header className={`border-b border-slate-200 bg-white ${className}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* 좌측: 뒤로가기 또는 로고/홈 */}
        <div className="flex items-center gap-3">
          {shouldShowBack ? (
            onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-lg font-semibold text-slate-800 hover:border-teal-600 hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
                aria-label={backLabel}
              >
                <span aria-hidden="true" className="text-xl">←</span>
                <span>{backLabel}</span>
              </button>
            ) : (
              <Link
                to={backTo ?? homePath}
                className="flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-lg font-semibold text-slate-800 hover:border-teal-600 hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
                aria-label={backLabel}
              >
                <span aria-hidden="true" className="text-xl">←</span>
                <span>{backLabel}</span>
              </Link>
            )
          ) : (
            <Link
              to={homePath}
              className="flex items-center gap-2 text-2xl font-bold tracking-tight text-teal-800 hover:text-teal-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
            >
              <span>이어봄</span>
            </Link>
          )}

          {title && (
            <span className="hidden text-xl font-bold text-slate-900 sm:inline">
              · {title}
            </span>
          )}
        </div>

        {/* 우측: 세션 칩 & 본인 바꾸기 */}
        {showSession && session && role && (
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm whitespace-nowrap sm:gap-2 sm:px-3 sm:py-1.5 sm:text-base">
              <span className="font-semibold text-slate-900">{session.staff.name}</span>
              <span className="hidden text-slate-500 sm:inline">{session.staff.code}</span>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800 sm:text-sm">
                {role.label}
              </span>
            </div>
            <button
              type="button"
              onClick={leave}
              className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 whitespace-nowrap hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 sm:px-3 sm:py-1.5 sm:text-base"
            >
              본인 바꾸기
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
