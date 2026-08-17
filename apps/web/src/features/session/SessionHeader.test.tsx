import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionHeader } from './SessionHeader'
import { SessionContext, type SessionContextValue } from './sessionContext'
import type { Staff } from './staffDirectory'

const mockStaffWithPin: Staff = {
  code: 'ST-001',
  name: '김하늘',
  jobRole: 'CAREGIVER',
  jobRoleLabel: '요양보호사',
  hasPin: true,
}

const mockStaffWithoutPin: Staff = {
  code: 'ST-002',
  name: '이도윤',
  jobRole: 'CAREGIVER',
  jobRoleLabel: '요양보호사',
  hasPin: false,
}

function renderSessionHeader(contextValue: SessionContextValue) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SessionContext.Provider value={contextValue}>
          <SessionHeader />
        </SessionContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SessionHeader', () => {
  const enter = vi.fn()
  const updateStaff = vi.fn()
  const leave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('세션이 없으면 아무것도 렌더링하지 않는다', () => {
    const { container } = renderSessionHeader({
      session: null,
      enter,
      updateStaff,
      leave,
    })

    expect(container).toBeEmptyDOMElement()
  })

  it('PIN이 설정된 직원은 PIN 변경 버튼과 🔒 배지가 표시된다', () => {
    renderSessionHeader({
      session: {
        entryRole: 'FIELD_WORKER',
        staff: mockStaffWithPin,
      },
      enter,
      updateStaff,
      leave,
    })

    expect(screen.getByText('김하늘')).toBeInTheDocument()
    expect(screen.getByText('ST-001')).toBeInTheDocument()
    expect(screen.getByText('🔒 PIN')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PIN 변경' })).toBeInTheDocument()
  })

  it('PIN이 없는 직원은 PIN 설정 버튼이 표시된다', () => {
    renderSessionHeader({
      session: {
        entryRole: 'FIELD_WORKER',
        staff: mockStaffWithoutPin,
      },
      enter,
      updateStaff,
      leave,
    })

    expect(screen.getByText('이도윤')).toBeInTheDocument()
    expect(screen.queryByText('🔒 PIN')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PIN 설정' })).toBeInTheDocument()
  })

  it('PIN 버튼을 클릭하면 PinSettingsModal이 열린다', () => {
    renderSessionHeader({
      session: {
        entryRole: 'FIELD_WORKER',
        staff: mockStaffWithPin,
      },
      enter,
      updateStaff,
      leave,
    })

    fireEvent.click(screen.getByRole('button', { name: 'PIN 변경' }))
    expect(screen.getByText('PIN 번호 변경 / 해제')).toBeInTheDocument()
  })

  it('본인 바꾸기 버튼을 누르면 leave가 호출된다', () => {
    renderSessionHeader({
      session: {
        entryRole: 'FIELD_WORKER',
        staff: mockStaffWithPin,
      },
      enter,
      updateStaff,
      leave,
    })

    fireEvent.click(screen.getByRole('button', { name: '본인 바꾸기' }))
    expect(leave).toHaveBeenCalledTimes(1)
  })
})
