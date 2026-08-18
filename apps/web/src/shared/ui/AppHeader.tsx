import { useState } from 'react'
import { ArrowLeft, Bell, KeyRound } from 'lucide-react'
import { Link } from 'react-router'
import { useUnreadCount } from '../../features/notification/useNotifications'
import { findEntryRole, homePathOf } from '../../features/session/entryRole'
import { PinSettingsModal } from '../../features/session/PinSettingsModal'
import { useSession } from '../../features/session/sessionContext'
import type { Staff } from '../../features/session/staffDirectory'

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
 * - 우측: 알림함(🔔 배지), PIN 설정/변경, 현재 로그인한 본인 칩 및 '본인 바꾸기' 버튼
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

  const shouldShowBack = showBack || Boolean(backTo) || Boolean(onBack)
  const homePath = session ? homePathOf(session.entryRole) : '/'
  const role = session ? findEntryRole(session.entryRole) : null

  const handlePinUpdateSuccess = (updatedStaff: Staff) => {
    updateStaff(updatedStaff)
    setIsPinModalOpen(false)
  }

  return (
    <>
      <header className={`border-b border-border-divider bg-white ${className}`}>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* 좌측: 뒤로가기 또는 로고/홈 */}
          <div className="flex items-center gap-3">
            {shouldShowBack ? (
              onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex min-h-12 items-center gap-1.5 rounded-xl border border-border-card bg-white px-3 py-2 text-lg font-semibold text-ink hover:border-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  aria-label={backLabel}
                >
                  <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
                  <span>{backLabel}</span>
                </button>
              ) : (
                <Link
                  to={backTo ?? homePath}
                  className="flex min-h-12 items-center gap-1.5 rounded-xl border border-border-card bg-white px-3 py-2 text-lg font-semibold text-ink hover:border-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  aria-label={backLabel}
                >
                  <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
                  <span>{backLabel}</span>
                </Link>
              )
            ) : (
              <Link
                to={homePath}
                className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary hover:brightness-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                <span>이어봄</span>
              </Link>
            )}

            {title && (
              <span className="hidden text-xl font-bold text-ink sm:inline">
                · {title}
              </span>
            )}
          </div>

          {/* 우측: 알림함 버튼 & PIN 설정 & 세션 칩 & 본인 바꾸기 */}
          {showSession && session && role && (
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* PIN 설정 / 변경 버튼 */}
              <button
                id="pin-settings-btn"
                type="button"
                onClick={() => setIsPinModalOpen(true)}
                className="flex min-h-10 items-center gap-1 rounded-xl border border-border-card bg-white px-2.5 py-1 text-sm font-semibold text-ink-muted whitespace-nowrap hover:border-primary hover:bg-primary-soft hover:text-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:px-3 sm:py-1.5 sm:text-base"
                title={session.staff.hasPin ? 'PIN 번호 변경 / 해제' : 'PIN 번호 신규 등록'}
              >
                <KeyRound size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>{session.staff.hasPin ? 'PIN 변경' : 'PIN 설정'}</span>
              </button>

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

              <div className="flex items-center gap-1.5 rounded-full bg-btn-neutral px-2.5 py-1 text-sm whitespace-nowrap sm:gap-2 sm:px-3 sm:py-1.5 sm:text-base">
                <span className="font-semibold text-ink">{session.staff.name}</span>
                <span className="hidden text-ink-muted sm:inline">{session.staff.code}</span>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary sm:text-sm">
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
              <button
                type="button"
                onClick={leave}
                className="rounded-xl border border-border-card bg-white px-2.5 py-1 text-sm font-semibold text-ink-muted whitespace-nowrap hover:border-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:px-3 sm:py-1.5 sm:text-base"
              >
                본인 바꾸기
              </button>
            </div>
          )}
        </div>
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
