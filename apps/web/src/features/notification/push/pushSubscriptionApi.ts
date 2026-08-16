import { apiFetch } from '../../../shared/api/client'

export type PushPublicKeyResponse = {
  publicKey: string
}

export type PushSubscriptionPayload = {
  staffCode: string
  endpoint: string
  p256dh: string
  auth: string
}

export type PushUnsubscribePayload = {
  endpoint: string
}

/**
 * 서버 VAPID 공개키 조회.
 */
export async function fetchVapidPublicKey(): Promise<string> {
  const response = await apiFetch<PushPublicKeyResponse>('/api/push-subscriptions/public-key')
  return response.publicKey
}

/**
 * 기기 구독 등록 / 직원 재연결 (upsert).
 */
export async function registerPushSubscription(payload: PushSubscriptionPayload): Promise<void> {
  await apiFetch<void>('/api/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * 기기 구독 해제 / 직원 연결 끊기.
 */
export async function unregisterPushSubscription(endpoint: string): Promise<void> {
  const payload: PushUnsubscribePayload = { endpoint }
  await apiFetch<void>('/api/push-subscriptions', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  })
}
