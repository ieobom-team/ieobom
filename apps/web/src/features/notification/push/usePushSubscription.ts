import { useCallback, useEffect, useState } from 'react'
import { isPushSupported } from './pushSupport'
import {
  fetchVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
} from './pushSubscriptionApi'

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 진입 본인 변경 시 기기 구독을 새 직원으로 재연결 (Manyfast F-QPWGNS action)
 */
export async function syncPushSubscriptionOnSessionEnter(newStaffCode: string): Promise<void> {
  if (!isPushSupported() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    const p256dh = arrayBufferToBase64(sub.getKey('p256dh'))
    const auth = arrayBufferToBase64(sub.getKey('auth'))

    await registerPushSubscription({
      staffCode: newStaffCode,
      endpoint: sub.endpoint,
      p256dh,
      auth,
    })
  } catch {
    // 백그라운드 동기화 실패는 조용히 무시
  }
}

/**
 * 본인 선택 해제 시 기기 구독 직원 연결 끊기 (Manyfast F-QPWGNS action)
 */
export async function syncPushSubscriptionOnSessionLeave(): Promise<void> {
  if (!isPushSupported() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    await unregisterPushSubscription(sub.endpoint)
  } catch {
    // 조용히 무시
  }
}

export function usePushSubscription(currentStaffCode: string | null) {
  const supported = isPushSupported()
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    supported ? Notification.permission : 'unsupported'
  )
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // 현재 브라우저의 구독 상태 확인
  const checkSubscription = useCallback(async () => {
    if (!supported || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        setIsSubscribed(false)
        return
      }
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
      setPermission(Notification.permission)
    } catch {
      setIsSubscribed(false)
    }
  }, [supported])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

  // 푸시 알림 구독 켜기
  const subscribe = useCallback(async () => {
    if (!supported || !currentStaffCode) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setIsLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const publicKey = await fetchVapidPublicKey()
      if (!publicKey) {
        throw new Error('서버 VAPID 공개키가 설정되지 않았습니다.')
      }

      const applicationServerKey = urlBase64ToUint8Array(publicKey)
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      })

      const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'))
      const auth = arrayBufferToBase64(subscription.getKey('auth'))

      await registerPushSubscription({
        staffCode: currentStaffCode,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      })

      setIsSubscribed(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알림 설정 중 오류가 발생했습니다.'
      setError(message)
      setIsSubscribed(false)
    } finally {
      setIsLoading(false)
    }
  }, [supported, currentStaffCode])

  // 푸시 알림 구독 끄기
  const unsubscribe = useCallback(async () => {
    if (!supported) return

    setIsLoading(true)
    setError(null)

    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await unregisterPushSubscription(sub.endpoint)
        }
      }
      setIsSubscribed(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알림 해제 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [supported])

  // 세션 본인 변경 시 기기 구독을 새 직원으로 재연결
  const relinkStaff = useCallback(
    async (newStaffCode: string) => {
      if (!supported || !newStaffCode) return

      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) return
        const sub = await reg.pushManager.getSubscription()
        if (!sub) return

        const p256dh = arrayBufferToBase64(sub.getKey('p256dh'))
        const auth = arrayBufferToBase64(sub.getKey('auth'))

        await registerPushSubscription({
          staffCode: newStaffCode,
          endpoint: sub.endpoint,
          p256dh,
          auth,
        })
      } catch {
        // 백그라운드 재연결 실패는 조용히 무시
      }
    },
    [supported]
  )

  // 본인 선택 해제 시 기기 구독 직원 연결 해제
  const unlinkStaff = useCallback(async () => {
    if (!supported) return

    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return

      await unregisterPushSubscription(sub.endpoint)
    } catch {
      // 조용히 무시
    }
  }, [supported])

  return {
    isSupported: supported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    relinkStaff,
    unlinkStaff,
    refreshStatus: checkSubscription,
  }
}
