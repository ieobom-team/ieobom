/**
 * 브라우저 웹 푸시 지원 여부 및 권한 판정. (Manyfast F-QPWGNS, #72)
 *
 * 초기 범위: 안드로이드 크롬 및 PC 웹. iOS 는 제외한다.
 * Manyfast: "지원하지 않는 브라우저에서는 설정 항목 자체가 보이지 않는다 —
 * PushManager 존재 여부만으로 판단하지 말고 display-mode: standalone 까지 확인한다"
 */

export function isPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const hasApis =
    'serviceWorker' in navigator &&
    Boolean(navigator.serviceWorker) &&
    'PushManager' in window &&
    Boolean((window as unknown as { PushManager?: unknown }).PushManager) &&
    'Notification' in window &&
    Boolean((window as unknown as { Notification?: unknown }).Notification)

  if (!hasApis) {
    return false
  }

  // iOS Safari 판정 (iOS 홈 화면 PWA 가 아닌 일반 탭 사파리는 푸시를 지원하지 않거나 불안정함)
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)

  if (isIOS) {
    const isStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches
    if (!isStandalone) {
      return false
    }
    return false
  }

  return true
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) {
    return 'unsupported'
  }
  return Notification.permission
}
