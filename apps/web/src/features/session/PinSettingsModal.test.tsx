import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinSettingsModal } from './PinSettingsModal'
import * as staffApi from './staffApi'
import type { Staff } from './staffDirectory'

describe('PinSettingsModal', () => {
  const onSuccess = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('PIN이 없는 직원은 신규 등록 모드로 렌더링되고 새 PIN 등록에 성공한다', async () => {
    const staffWithoutPin: Staff = {
      code: 'ST-002',
      name: '이도윤',
      hasPin: false,
    }

    const updatedStaff: Staff = {
      ...staffWithoutPin,
      hasPin: true,
    }

    vi.spyOn(staffApi, 'updateStaffPin').mockResolvedValueOnce(updatedStaff)

    render(<PinSettingsModal staff={staffWithoutPin} onSuccess={onSuccess} onClose={onClose} />)

    expect(screen.getByText('PIN 번호 신규 등록')).toBeInTheDocument()
    expect(screen.queryByLabelText('현재 PIN 번호')).not.toBeInTheDocument()

    const newPinInput = screen.getByLabelText('PIN 번호')
    const confirmInput = screen.getByLabelText('PIN 번호 확인')

    fireEvent.change(newPinInput, { target: { value: '1234' } })
    fireEvent.change(confirmInput, { target: { value: '1234' } })

    fireEvent.click(screen.getByRole('button', { name: 'PIN 번호 등록하기' }))

    await waitFor(() => {
      expect(staffApi.updateStaffPin).toHaveBeenCalledWith('ST-002', undefined, '1234')
      expect(onSuccess).toHaveBeenCalledWith(updatedStaff)
    })
  })

  it('PIN이 있는 직원은 현재 PIN을 포함하여 변경할 수 있다', async () => {
    const staffWithPin: Staff = {
      code: 'ST-001',
      name: '김하늘',
      hasPin: true,
    }

    const updatedStaff: Staff = {
      ...staffWithPin,
      hasPin: true,
    }

    vi.spyOn(staffApi, 'updateStaffPin').mockResolvedValueOnce(updatedStaff)

    render(<PinSettingsModal staff={staffWithPin} onSuccess={onSuccess} onClose={onClose} />)

    expect(screen.getByText('PIN 번호 변경 / 해제')).toBeInTheDocument()
    expect(screen.getByLabelText('현재 PIN 번호')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('현재 PIN 번호'), { target: { value: '1234' } })
    fireEvent.change(screen.getByLabelText('새 PIN 번호'), { target: { value: '5678' } })
    fireEvent.change(screen.getByLabelText('새 PIN 번호 확인'), { target: { value: '5678' } })

    fireEvent.click(screen.getByRole('button', { name: 'PIN 번호 변경하기' }))

    await waitFor(() => {
      expect(staffApi.updateStaffPin).toHaveBeenCalledWith('ST-001', '1234', '5678')
      expect(onSuccess).toHaveBeenCalledWith(updatedStaff)
    })
  })

  it('새 PIN과 확인이 일치하지 않으면 오류를 표시한다', async () => {
    const staffWithoutPin: Staff = {
      code: 'ST-002',
      name: '이도윤',
      hasPin: false,
    }

    const updateSpy = vi.spyOn(staffApi, 'updateStaffPin')

    render(<PinSettingsModal staff={staffWithoutPin} onSuccess={onSuccess} onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('PIN 번호'), { target: { value: '1234' } })
    fireEvent.change(screen.getByLabelText('PIN 번호 확인'), { target: { value: '9999' } })

    fireEvent.click(screen.getByRole('button', { name: 'PIN 번호 등록하기' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('새 PIN 번호가 일치하지 않습니다')
      expect(updateSpy).not.toHaveBeenCalled()
    })
  })

  it('PIN 해제 버튼 클릭 시 현재 PIN과 함께 빈 문자열을 전달한다', async () => {
    const staffWithPin: Staff = {
      code: 'ST-001',
      name: '김하늘',
      hasPin: true,
    }

    const resetStaff: Staff = {
      ...staffWithPin,
      hasPin: false,
    }

    vi.spyOn(staffApi, 'updateStaffPin').mockResolvedValueOnce(resetStaff)

    render(<PinSettingsModal staff={staffWithPin} onSuccess={onSuccess} onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('현재 PIN 번호'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'PIN 번호 해제 (무인증으로 변경)' }))

    await waitFor(() => {
      expect(staffApi.updateStaffPin).toHaveBeenCalledWith('ST-001', '1234', '')
      expect(onSuccess).toHaveBeenCalledWith(resetStaff)
    })
  })
})
