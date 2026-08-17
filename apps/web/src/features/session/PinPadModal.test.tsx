import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinPadModal } from './PinPadModal'
import * as staffApi from './staffApi'
import type { Staff } from './staffDirectory'

const mockStaff: Staff = {
  code: 'ST-001',
  name: '김하늘',
  jobRole: 'CAREGIVER',
  jobRoleLabel: '요양보호사',
  hasPin: true,
}

describe('PinPadModal', () => {
  const onSuccess = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('직원 이름과 사번, 0~9 숫자 키패드를 렌더링한다', () => {
    render(<PinPadModal staff={mockStaff} onSuccess={onSuccess} onClose={onClose} />)

    expect(screen.getByText('PIN 번호 입력')).toBeInTheDocument()
    expect(screen.getByText('김하늘')).toBeInTheDocument()
    expect(screen.getByText('(ST-001)')).toBeInTheDocument()

    // 0~9 버튼 확인
    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument()
    }
  })

  it('터치 키패드로 4자리 이상 입력하고 확인을 누르면 검증 성공 시 onSuccess를 호출한다', async () => {
    vi.spyOn(staffApi, 'verifyStaffPin').mockResolvedValueOnce({
      valid: true,
      locked: false,
      remainingAttempts: 5,
    })

    render(<PinPadModal staff={mockStaff} onSuccess={onSuccess} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    const confirmBtn = screen.getByRole('button', { name: '확인' })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(staffApi.verifyStaffPin).toHaveBeenCalledWith('ST-001', '1234')
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('PIN 불일치 시 남은 시도 횟수 안내를 표시한다', async () => {
    vi.spyOn(staffApi, 'verifyStaffPin').mockResolvedValueOnce({
      valid: false,
      locked: false,
      remainingAttempts: 4,
    })

    render(<PinPadModal staff={mockStaff} onSuccess={onSuccess} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('남은 시도: 4회')
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })

  it('5회 연속 실패 시 1분간 잠금 안내를 표시하고 입력을 비활성화한다', async () => {
    vi.spyOn(staffApi, 'verifyStaffPin').mockResolvedValueOnce({
      valid: false,
      locked: true,
      remainingAttempts: 0,
    })

    render(<PinPadModal staff={mockStaff} onSuccess={onSuccess} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('5회 연속 실패하여 1분간 입력이 제한됩니다')
      expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
    })
  })

  it('PC 물리 키보드 입력을 지원한다', async () => {
    vi.spyOn(staffApi, 'verifyStaffPin').mockResolvedValueOnce({
      valid: true,
      locked: false,
      remainingAttempts: 5,
    })

    render(<PinPadModal staff={mockStaff} onSuccess={onSuccess} onClose={onClose} />)

    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: '6' })
    fireEvent.keyDown(window, { key: '7' })
    fireEvent.keyDown(window, { key: '8' })
    fireEvent.keyDown(window, { key: 'Enter' })

    await waitFor(() => {
      expect(staffApi.verifyStaffPin).toHaveBeenCalledWith('ST-001', '5678')
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('Escape 키를 누르면 모달을 닫는다', () => {
    render(<PinPadModal staff={mockStaff} onSuccess={onSuccess} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
