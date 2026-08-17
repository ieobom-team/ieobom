import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminStaffPinResetSection } from './AdminStaffPinResetSection'
import * as staffApi from '../session/staffApi'
import { cacheDirectory, type Staff } from '../session/staffDirectory'

const mockStaffList: Staff[] = [
  { code: 'ST-001', name: '김하늘', jobRole: 'CAREGIVER', jobRoleLabel: '요양보호사', hasPin: true },
  { code: 'ST-002', name: '이도윤', jobRole: 'CAREGIVER', jobRoleLabel: '요양보호사', hasPin: false },
]

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminStaffPinResetSection />
    </QueryClientProvider>,
  )
}

describe('AdminStaffPinResetSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheDirectory(mockStaffList)
    vi.spyOn(staffApi, 'fetchStaffDirectory').mockResolvedValue(mockStaffList)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('직원 목록과 PIN 설정 상태를 표시하고 PIN 초기화를 수행한다', async () => {
    const resetStaff: Staff = {
      ...mockStaffList[0],
      hasPin: false,
    }

    vi.spyOn(staffApi, 'resetStaffPin').mockResolvedValueOnce(resetStaff)

    renderWithQueryClient()

    await waitFor(() => {
      expect(screen.getByText('김하늘')).toBeInTheDocument()
      expect(screen.getByText('🔒 PIN 설정됨')).toBeInTheDocument()
      expect(screen.getByText('무인증')).toBeInTheDocument()
    })

    const resetBtn = screen.getByRole('button', { name: 'PIN 초기화' })
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(staffApi.resetStaffPin).toHaveBeenCalledWith('ST-001')
      expect(screen.getByRole('status')).toHaveTextContent('김하늘 님의 PIN이 초기화(무인증)되었습니다')
    })
  })
})
