import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { isPushSupported, getNotificationPermission } from './pushSupport'

describe('pushSupport', () => {
  const originalUserAgent = navigator.userAgent
  const originalPlatform = navigator.platform
  const originalMaxTouchPoints = navigator.maxTouchPoints

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true })
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: originalMaxTouchPoints, configurable: true })
    delete (window as unknown as { PushManager?: unknown }).PushManager
    delete (window as unknown as { Notification?: unknown }).Notification
  })

  it('ServiceWorker, PushManager, Notification 이 모두 있으면 true', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      configurable: true,
    })
    ;(window as unknown as { PushManager: unknown }).PushManager = class {}
    ;(window as unknown as { Notification: unknown }).Notification = { permission: 'default' }

    expect(isPushSupported()).toBe(true)
    expect(getNotificationPermission()).toBe('default')
  })

  it('ServiceWorker 가 없으면 false', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
    ;(window as unknown as { PushManager: unknown }).PushManager = class {}
    ;(window as unknown as { Notification: unknown }).Notification = { permission: 'default' }

    expect(isPushSupported()).toBe(false)
    expect(getNotificationPermission()).toBe('unsupported')
  })

  it('iOS Safari 환경은 지원하지 않음 (false)', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    })
    ;(window as unknown as { PushManager: unknown }).PushManager = class {}
    ;(window as unknown as { Notification: unknown }).Notification = { permission: 'default' }

    expect(isPushSupported()).toBe(false)
  })
})
