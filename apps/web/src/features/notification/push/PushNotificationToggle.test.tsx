import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PushNotificationToggle } from './PushNotificationToggle'
import * as pushSupport from './pushSupport'

describe('PushNotificationToggle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('푸시 미지원 브라우저에서는 아무것도 렌더링하지 않는다 (null)', () => {
    vi.spyOn(pushSupport, 'isPushSupported').mockReturnValue(false)

    const { container } = render(<PushNotificationToggle staffCode="ST-001" />)
    expect(container.firstChild).toBeNull()
  })

  it('푸시 지원 브라우저에서는 토글 UI 가 렌더링된다', () => {
    vi.spyOn(pushSupport, 'isPushSupported').mockReturnValue(true)
    vi.stubGlobal('Notification', { permission: 'default' })
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(null),
      },
    })

    render(<PushNotificationToggle staffCode="ST-001" />)
    expect(screen.getByTestId('push-notification-settings')).toBeInTheDocument()
    expect(screen.getByText('이 기기에서 알림 받기')).toBeInTheDocument()
  })

  it('알림 권한이 차단된 경우 안내 문구를 표시한다', () => {
    vi.spyOn(pushSupport, 'isPushSupported').mockReturnValue(true)
    vi.stubGlobal('Notification', { permission: 'denied' })
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(null),
      },
    })

    render(<PushNotificationToggle staffCode="ST-001" />)
    expect(
      screen.getByText(/브라우저에서 알림 권한이 차단되어 있습니다/)
    ).toBeInTheDocument()
  })
})
