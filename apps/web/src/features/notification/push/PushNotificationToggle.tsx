import { Bell, BellOff, AlertCircle } from 'lucide-react'
import { usePushSubscription } from './usePushSubscription'

interface PushNotificationToggleProps {
  staffCode: string | null
}

export function PushNotificationToggle({ staffCode }: PushNotificationToggleProps) {
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushSubscription(staffCode)

  if (!isSupported) {
    return null
  }

  const isDenied = permission === 'denied'

  const handleToggle = () => {
    if (isLoading) return
    if (isSubscribed) {
      unsubscribe()
    } else {
      subscribe()
    }
  }

  return (
    <div
      data-testid="push-notification-settings"
      className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-4 text-stone-800"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isSubscribed ? 'bg-primary-100 text-primary-700' : 'bg-stone-200 text-stone-600'
            }`}
          >
            {isSubscribed ? (
              <Bell className="w-5 h-5" aria-hidden="true" />
            ) : (
              <BellOff className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm sm:text-base">
              이 기기에서 알림 받기
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              앱을 닫아도 새 업무 배정을 알려 드립니다 (실명·민감정보 미포함)
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading || isDenied || !staffCode}
          aria-pressed={isSubscribed}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
            isSubscribed ? 'bg-primary-600' : 'bg-stone-300'
          } ${isLoading || isDenied || !staffCode ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="sr-only">이 기기에서 알림 받기 토글</span>
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isSubscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isDenied && (
        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>브라우저에서 알림 권한이 차단되어 있습니다. 브라우저 설정에서 권한을 허용해 주세요.</span>
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
    </div>
  )
}
