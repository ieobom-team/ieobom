import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useUnreadCount } from '../notification/useNotifications'
import { findEntryRole } from './entryRole'
import { PinSettingsModal } from './PinSettingsModal'
import { useSession } from './sessionContext'
import type { Staff } from './staffDirectory'

/**
 * 지금 누구로 들어와 있는지 보여 준다.
 *
 * 현장에서는 한 기기를 여러 직원이 돌려 쓰므로 다른 사람으로 바꾸는 길이 화면에 있어야 한다.
 * 선택을 지우면 진입 선택 화면으로 되돌아간다.
 *
 * 공용 기기 보호를 위해 직원이 자신의 4~6자리 PIN을 설정/변경할 수 있는 버튼을 제공한다. (#83, #84)
 *
 * 알림 배지: 당일 미읽음 개수. 0이면 숫자를 표시하지 않는다. (F-JIEOJO display)
 * 폴링은 useUnreadCount → useNotifications 내부에서 30초마다 실행된다.
 * session 이 없으면 훅이 요청을 보내지 않는다. (enabled: !!staffCode)
 */
export function SessionHeader() {
  const { session, updateStaff, leave } = useSession()
  const navigate = useNavigate()
  const unreadCount = useUnreadCount(session?.staff.code)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)

  if (!session) {
    return null
  }

  const role = findEntryRole(session.entryRole)

  const handlePinUpdateSuccess = (updatedStaff: Staff) => {
    updateStaff(updatedStaff)
    setIsPinModalOpen(false)
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <p className="text-xl text-slate-700">
          <span className="font-semibold text-slate-900">{session.staff.name}</span>
          <span className="ml-2 text-lg text-slate-500">{session.staff.code}</span>
          <span className="ml-3 rounded-full bg-teal-50 px-3 py-1 text-lg font-semibold text-teal-800">
            {role.label}
          </span>
          {session.staff.hasPin && (
            <span
              className="ml-2 inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-600"
              title="PIN 잠금 설정됨"
            >
              🔒 PIN
            </span>
          )}
        </p>

        <div className="flex items-center gap-3">
          {/* PIN 설정 / 변경 / 해제 버튼 */}
          <button
            id="pin-settings-btn"
            type="button"
            onClick={() => setIsPinModalOpen(true)}
            className="rounded-xl border-2 border-slate-300 px-4 py-3 text-xl font-semibold text-slate-700 hover:bg-slate-50"
          >
            {session.staff.hasPin ? 'PIN 변경' : 'PIN 설정'}
          </button>

          {/* 알림함 버튼 — 배지는 당일 미읽음 건수. 0이면 숫자 없음. (F-JIEOJO display) */}
          <button
            id="notification-inbox-btn"
            type="button"
            onClick={() => void navigate('/notifications')}
            className="relative rounded-xl border-2 border-slate-300 px-4 py-3 text-xl font-semibold text-slate-700"
            aria-label={
              unreadCount > 0 ? `알림함 (미읽음 ${unreadCount}건)` : '알림함'
            }
          >
            🔔
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* 선택을 지우면 라우트 가드가 진입 선택 화면으로 되돌린다. */}
          <button
            type="button"
            onClick={leave}
            className="rounded-xl border-2 border-slate-300 px-4 py-3 text-xl font-semibold text-slate-700"
          >
            본인 바꾸기
          </button>
        </div>
      </header>

      {isPinModalOpen && (
        <PinSettingsModal
          staff={session.staff}
          onSuccess={handlePinUpdateSuccess}
          onClose={() => setIsPinModalOpen(false)}
        />
      )}
    </>
  )
}
