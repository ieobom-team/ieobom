import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntrySelectPage } from './EntrySelectPage'
import { SessionProvider } from './SessionProvider'
import * as staffApi from './staffApi'
import { cacheDirectory, type Staff } from './staffDirectory'

const mockStaffList: Staff[] = [
  { code: 'ST-001', name: '김하늘', jobRole: 'CAREGIVER', jobRoleLabel: '요양보호사', hasPin: true },
  { code: 'ST-002', name: '이도윤', jobRole: 'CAREGIVER', jobRoleLabel: '요양보호사', hasPin: false },
]

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SessionProvider>
          <EntrySelectPage />
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EntrySelectPage PIN 진입 흐름', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    cacheDirectory(mockStaffList)
    vi.spyOn(staffApi, 'fetchStaffDirectory').mockResolvedValue(mockStaffList)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('PIN이 없는 직원을 선택하면 무인증으로 즉시 진입한다', async () => {
    renderWithProviders()

    // 1. 역할 선택 (현장 근무자)
    fireEvent.click(screen.getByRole('button', { name: /현장 근무자/ }))

    // 2. PIN 없는 직원 (이도윤) 선택
    await waitFor(() => {
      expect(screen.getByText('이도윤')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('이도윤'))

    // PIN 모달이 뜨지 않음
    expect(screen.queryByText('PIN 번호 입력')).not.toBeInTheDocument()
  })

  it('PIN이 있는 직원을 선택하면 PinPadModal이 열리고 검증 성공 시 진입한다', async () => {
    vi.spyOn(staffApi, 'verifyStaffPin').mockResolvedValueOnce({
      valid: true,
      locked: false,
      remainingAttempts: 5,
    })

    renderWithProviders()

    // 1. 역할 선택
    fireEvent.click(screen.getByRole('button', { name: /현장 근무자/ }))

    // 2. PIN 있는 직원 (김하늘) 선택
    await waitFor(() => {
      expect(screen.getByText('김하늘')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('김하늘'))

    // PIN 입력 모달이 뜸
    expect(screen.getByText('PIN 번호 입력')).toBeInTheDocument()

    // 3. 4자리 입력 후 확인
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    await waitFor(() => {
      expect(staffApi.verifyStaffPin).toHaveBeenCalledWith('ST-001', '1234')
    })
  })
})
