import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../shared/api/queryClient'
import { SessionProvider } from '../session/SessionProvider'
import { saveSession } from '../session/sessionStorage'
import { seedStaffCache, TEST_STAFF } from '../session/staffFixture'
import { NotificationInboxPage } from './NotificationInboxPage'
import type { NotificationListResponse } from './notificationApi'
import * as notificationApi from './notificationApi'

// 세션: ST-004 최민재 (간호조무사)
const 최민재 = TEST_STAFF[3]

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/notifications']}>
      <QueryClientProvider client={createQueryClient()}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

function 알림응답(patch: Partial<NotificationListResponse> = {}): NotificationListResponse {
  return {
    unreadCount: 0,
    today: [],
    past: [],
    ...patch,
  }
}

beforeEach(() => {
  seedStaffCache()
  saveSession({ entryRole: 'FIELD_WORKER', staff: 최민재 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NotificationInboxPage', () => {
  it('알림이 없을 때 빈 상태 문구를 보여 준다', async () => {
    vi.spyOn(notificationApi, 'fetchNotifications').mockResolvedValue(알림응답())

    render(<NotificationInboxPage />, { wrapper: Wrapper })

    expect(await screen.findByText('알림이 없습니다')).toBeTruthy()
  })

  it('오늘 알림 목록을 렌더한다', async () => {
    const 알림 = 오늘알림()
    vi.spyOn(notificationApi, 'fetchNotifications').mockResolvedValue(
      알림응답({ unreadCount: 1, today: [알림] }),
    )

    render(<NotificationInboxPage />, { wrapper: Wrapper })

    expect(await screen.findByText('오늘 알림')).toBeTruthy()
    expect(screen.getByText('김말순')).toBeTruthy()
  })

  it('지난 알림은 접혀 있다가 버튼 클릭 시 펼쳐진다', async () => {
    const 알림 = 지난알림()
    vi.spyOn(notificationApi, 'fetchNotifications').mockResolvedValue(
      알림응답({ past: [알림] }),
    )

    render(<NotificationInboxPage />, { wrapper: Wrapper })

    const toggle = await screen.findByRole('button', { name: /지난 알림/ })
    expect(toggle).toBeTruthy()
    // 처음엔 내용이 없다
    expect(screen.queryByText('김말순')).toBeNull()

    // 펼치기
    await userEvent.click(toggle)
    expect(screen.getByText('김말순')).toBeTruthy()
  })

  it('항목 클릭 시 markNotificationRead 가 호출된다', async () => {
    const 알림 = 오늘알림()
    const mockFetch = vi
      .spyOn(notificationApi, 'fetchNotifications')
      .mockResolvedValue(알림응답({ unreadCount: 1, today: [알림] }))
    const mockMark = vi
      .spyOn(notificationApi, 'markNotificationRead')
      .mockResolvedValue({ ...알림, read: true, readAt: '2026-08-15T10:00:00Z' })

    render(<NotificationInboxPage />, { wrapper: Wrapper })

    // 업무 내용 버튼 클릭
    const itemBtn = await screen.findByRole('button', { name: /김말순 — 저녁 식사량 확인/ })
    await userEvent.click(itemBtn)

    expect(mockMark).toHaveBeenCalledWith(알림.id, 최민재.code)
    expect(mockFetch).toHaveBeenCalled()
  })

  it('알림 조회 실패 시 오류 메시지를 표시한다', async () => {
    vi.spyOn(notificationApi, 'fetchNotifications').mockRejectedValue(new Error('network'))

    render(<NotificationInboxPage />, { wrapper: Wrapper })

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('알림을 불러오지 못했습니다')).toBeTruthy()
  })

  it('안전 관련 알림에 "안전" 배지를 표시한다', async () => {
    vi.spyOn(notificationApi, 'fetchNotifications').mockResolvedValue(
      알림응답({ today: [오늘알림({ safetyRelated: true })] }),
    )

    render(<NotificationInboxPage />, { wrapper: Wrapper })

    expect(await screen.findByText('안전')).toBeTruthy()
  })
})

// ─── 픽스처 헬퍼 ──────────────────────────────────────────────────

import type { NotificationResponse } from './notificationApi'
import type { TaskResponse } from '../task/taskApi'

function 업무픽스처(patch: Partial<TaskResponse> = {}): TaskResponse {
  return {
    id: 10,
    handoverCardId: 31,
    careRecipientId: 1,
    careRecipientName: '김말순',
    content: '저녁 식사량 확인',
    assigneeJobRole: 'NURSE_AIDE',
    assigneeJobRoleLabel: '간호조무사',
    assigneeName: null,
    claimedAt: null,
    claimMethod: null,
    claimMethodLabel: null,
    claimable: true,
    dueTime: '17:30',
    status: 'PENDING',
    statusLabel: '미처리',
    delegated: false,
    completedAt: null,
    completedByName: null,
    createdAt: '2026-08-15T09:00:00Z',
    ...patch,
  }
}

function 오늘알림(patch: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 1,
    type: 'TASK_ASSIGNED',
    typeLabel: '새 업무 배정',
    read: false,
    actorName: '강태호',
    safetyRelated: false,
    createdAt: '2026-08-15T09:00:00Z',
    readAt: null,
    task: 업무픽스처(),
    ...patch,
  }
}

function 지난알림(patch: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    ...오늘알림(),
    id: 2,
    read: true,
    readAt: '2026-08-14T10:00:00Z',
    createdAt: '2026-08-14T09:00:00Z',
    ...patch,
  }
}
