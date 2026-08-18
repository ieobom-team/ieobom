import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronLeft, KeyRound } from 'lucide-react'
import { Link } from 'react-router'
import { useUnreadCount } from '../../features/notification/useNotifications'
import { findEntryRole, homePathOf } from '../../features/session/entryRole'
import { PinSettingsModal } from '../../features/session/PinSettingsModal'
import { useSession } from '../../features/session/sessionContext'
import type { Staff } from '../../features/session/staffDirectory'

const MOBILE_SESSION_MENU_QUERY = '(max-width: 639px)'

/** `sm` 미만에서는 이름/역할 칩을 탭해야 "본인 바꾸기"·"PIN 설정"이 드롭다운으로 열린다. (#114) */
function useIsMobileHeader(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_SESSION_MENU_QUERY).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_SESSION_MENU_QUERY)
    const handleChange = () => setIsMobile(mql.matches)
    handleChange()
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}

export type AppHeaderProps = {
  /** 페이지 제목 (생략 시 2행 자체를 렌더링하지 않음) */
  title?: string
  /** 뒤로가기 대상 경로 (예: "/handover-cards") */
  backTo?: string
  /** 뒤로가기 aria-label (기본값: "이전", 화면에는 표시되지 않음) */
  backLabel?: string
  /** 뒤로가기 버튼 강제 표시 여부 */
  showBack?: boolean
  /** 뒤로가기 커스텀 클릭 핸들러 */
  onBack?: () => void
  /** 세션 식별 바 표시 여부 (기본값: true) */
  showSession?: boolean
  className?: string
}

const TITLE_ROW_BASE =
  'mx-auto flex min-h-12 w-full max-w-6xl items-center gap-1 px-4 py-2.5 text-lg font-bold text-ink sm:px-6'
const TITLE_ROW_INTERACTIVE =
  'text-left hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/30'

/**
 * 전 화면 공통 글로벌 헤더 (2행 구조).
 *
 * - 1행: 로고(항상 고정 노출) — 이름/역할 칩 — 본인 바꾸기 — PIN 설정 — 알림함
 *   - `sm` 미만: 칩 + 알림함만 노출. "본인 바꾸기"·"PIN 설정"은 칩을 탭하면 열리는 드롭다운 안. (#114)
 * - 2행 (title이 있을 때만): 뒤로가기가 있으면 "‹ 제목" 전체가 클릭 가능한 뒤로가기 줄,
 *   없으면 제목만 표시되는 일반 텍스트
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
  const { session, updateStaff, leave } = useSession()
  const unreadCount = useUnreadCount(session?.staff.code)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const isMobile = useIsMobileHeader()
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false)
  const sessionMenuRef = useRef<HTMLDivElement>(null)

  const shouldShowBack = showBack || Boolean(backTo) || Boolean(onBack)
  const homePath = session ? homePathOf(session.entryRole) : '/'
  const role = session ? findEntryRole(session.entryRole) : null

  const handlePinUpdateSuccess = (updatedStaff: Staff) => {
    updateStaff(updatedStaff)
    setIsPinModalOpen(false)
  }

  const handleSwitchStaff = () => {
    setIsSessionMenuOpen(false)
    leave()
  }

  const handleOpenPinModal = () => {
    setIsSessionMenuOpen(false)
    setIsPinModalOpen(true)
  }

  // 데스크톱으로 폭이 넓어지면 드롭다운 대신 펼침 레이아웃을 쓰므로 닫아 둔다.
  useEffect(() => {
    if (!isMobile) setIsSessionMenuOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (!isSessionMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(event.target as Node)) {
        setIsSessionMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSessionMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSessionMenuOpen])

  const titleRowContent = (
    <>
      {shouldShowBack && (
        <ChevronLeft size={22} strokeWidth={2.6} aria-hidden="true" className="shrink-0" />
      )}
      <span className="truncate">{title}</span>
    </>
  )

  return (
    <>
      <header className={`border-b border-border-divider bg-white ${className}`}>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* 1행 좌측: 로고 (뒤로가기 유무와 무관하게 항상 고정 노출) */}
          <Link
            to={homePath}
            className="flex items-center hover:brightness-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <img src="/logo.png" alt="이어봄" className="h-8 w-auto" />
          </Link>

          {/* 1행 우측: 이름/역할 칩 → 본인 바꾸기 → PIN 설정 → 알림함 (모바일은 칩 드롭다운으로 축약, #114) */}
          {showSession && session && role && (
            <div className="flex items-center gap-2 sm:gap-2.5">
              {isMobile ? (
                <div ref={sessionMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSessionMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={isSessionMenuOpen}
                    aria-controls="app-header-session-menu"
                    className="flex min-h-10 items-center gap-1.5 rounded-full bg-btn-neutral px-2.5 py-1 text-sm whitespace-nowrap hover:brightness-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  >
                    <span className="font-semibold text-ink">{session.staff.name}</span>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                      {role.label}
                    </span>
                    {session.staff.hasPin && (
                      <span
                        className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800"
                        title="PIN 잠금 설정됨"
                      >
                        🔒
                      </span>
                    )}
                  </button>

                  {isSessionMenuOpen && (
                    <div
                      id="app-header-session-menu"
                      role="menu"
                      className="absolute right-0 top-full z-20 mt-2 flex min-w-40 flex-col gap-1 rounded-xl border border-border-card bg-white p-1.5 shadow-md"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSwitchStaff}
                        className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-muted hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/30"
                      >
                        본인 바꾸기
                      </button>

                      <button
                        id="pin-settings-btn"
                        type="button"
                        role="menuitem"
                        onClick={handleOpenPinModal}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-muted hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/30"
                      >
                        <KeyRound size={16} strokeWidth={2.2} aria-hidden="true" />
                        <span>{session.staff.hasPin ? 'PIN 변경' : 'PIN 설정'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-full bg-btn-neutral px-3 py-1.5 text-base whitespace-nowrap">
                  <span className="font-semibold text-ink">{session.staff.name}</span>
                  <span className="text-ink-muted">{session.staff.code}</span>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-sm font-semibold text-primary">
                    {role.label}
                  </span>
                  {session.staff.hasPin && (
                    <span
                      className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800"
                      title="PIN 잠금 설정됨"
                    >
                      🔒
                    </span>
                  )}
                </div>
              )}

              {!isMobile && (
                <>
                  <button
                    type="button"
                    onClick={leave}
                    className="rounded-xl border border-border-card bg-white px-3 py-1.5 text-base font-semibold text-ink-muted whitespace-nowrap hover:border-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  >
                    본인 바꾸기
                  </button>

                  <button
                    id="pin-settings-btn"
                    type="button"
                    onClick={() => setIsPinModalOpen(true)}
                    className="flex min-h-10 items-center gap-1 rounded-xl border border-border-card bg-white px-3 py-1.5 text-base font-semibold text-ink-muted whitespace-nowrap hover:border-primary hover:bg-primary-soft hover:text-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                    title={session.staff.hasPin ? 'PIN 번호 변경 / 해제' : 'PIN 번호 신규 등록'}
                  >
                    <KeyRound size={16} strokeWidth={2.2} aria-hidden="true" />
                    <span>{session.staff.hasPin ? 'PIN 변경' : 'PIN 설정'}</span>
                  </button>
                </>
              )}

              <Link
                id="notification-inbox-btn"
                to="/notifications"
                className="relative flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-border-card bg-white p-2 text-ink-muted hover:border-primary hover:bg-primary-soft hover:text-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:px-3 sm:py-1.5"
                aria-label={
                  unreadCount > 0 ? `알림함 (미읽음 ${unreadCount}건)` : '알림함'
                }
              >
                <Bell size={20} strokeWidth={2.2} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-xs"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          )}
        </div>

        {/* 2행: title이 있을 때만 노출 */}
        {title &&
          (shouldShowBack ? (
            onBack ? (
              <button
                type="button"
                onClick={onBack}
                className={`${TITLE_ROW_BASE} ${TITLE_ROW_INTERACTIVE} border-t border-border-divider`}
                aria-label={backLabel}
              >
                {titleRowContent}
              </button>
            ) : (
              <Link
                to={backTo ?? homePath}
                className={`${TITLE_ROW_BASE} ${TITLE_ROW_INTERACTIVE} border-t border-border-divider`}
                aria-label={backLabel}
              >
                {titleRowContent}
              </Link>
            )
          ) : (
            <div className={`${TITLE_ROW_BASE} border-t border-border-divider`}>
              {titleRowContent}
            </div>
          ))}
      </header>

      {isPinModalOpen && session && (
        <PinSettingsModal
          staff={session.staff}
          onSuccess={handlePinUpdateSuccess}
          onClose={() => setIsPinModalOpen(false)}
        />
      )}
    </>
  )
}
