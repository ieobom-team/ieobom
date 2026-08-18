import { useState, type FormEvent } from 'react'
import { updateStaffPin } from './staffApi'
import type { Staff } from './staffDirectory'

export type PinSettingsModalProps = {
  staff: Staff
  onSuccess: (updatedStaff: Staff) => void
  onClose: () => void
}

/**
 * 직원의 4~6자리 숫자 PIN 신규 등록, 변경, 해제 모달. (Manyfast F-YJJJUX, #83, #84)
 */
export function PinSettingsModal({ staff, onSuccess, onClose }: PinSettingsModalProps) {
  const hasExistingPin = Boolean(staff.hasPin)

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validatePinFormat = (pin: string) => /^[0-9]{4,6}$/.test(pin)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (hasExistingPin && !currentPin) {
      setErrorMessage('현재 PIN 번호를 입력해 주세요.')
      return
    }

    if (!validatePinFormat(newPin)) {
      setErrorMessage('새 PIN 번호는 4~6자리 숫자로 입력해 주세요.')
      return
    }

    if (newPin !== newPinConfirm) {
      setErrorMessage('새 PIN 번호가 일치하지 않습니다. 다시 확인해 주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const updated = await updateStaffPin(
        staff.code,
        hasExistingPin ? currentPin : undefined,
        newPin,
      )
      onSuccess(updated)
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'PIN 변경에 실패했습니다. 다시 시도해 주세요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemovePin = async () => {
    if (hasExistingPin && !currentPin) {
      setErrorMessage('PIN을 해제하려면 현재 PIN 번호를 입력해 주세요.')
      return
    }

    if (!window.confirm('정말 PIN 번호를 해제하시겠습니까? 해제 시 비밀번호 없이 즉시 진입할 수 있습니다.')) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const updated = await updateStaffPin(
        staff.code,
        hasExistingPin ? currentPin : undefined,
        '', // 빈 값이면 PIN 해제
      )
      onSuccess(updated)
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'PIN 해제에 실패했습니다. 다시 시도해 주세요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-surface-modal p-6 shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 id="pin-settings-title" className="text-2xl font-bold text-ink">
              {hasExistingPin ? 'PIN 번호 변경 / 해제' : 'PIN 번호 신규 등록'}
            </h2>
            <p className="mt-1 text-lg text-ink-muted">
              <span className="font-semibold text-ink">{staff.name}</span>
              <span className="ml-1 text-ink-muted">({staff.code})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-ink-tertiary hover:bg-btn-neutral hover:text-ink"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-base text-ink-muted">
          공용 기기에서 내 알림과 업무를 안전하게 보호할 수 있는 4~6자리 숫자 PIN을 설정합니다.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-base font-semibold text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          {/* 기존 PIN 입력 (설정되어 있을 때만) */}
          {hasExistingPin && (
            <div>
              <label
                htmlFor="current-pin-input"
                className="block text-base font-semibold text-ink"
              >
                현재 PIN 번호
              </label>
              <input
                id="current-pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="현재 4~6자리 숫자"
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border-2 border-border-card px-4 py-3 text-xl tracking-widest text-ink focus:border-primary focus:outline-none"
              />
            </div>
          )}

          {/* 새 PIN */}
          <div>
            <label
              htmlFor="new-pin-input"
              className="block text-base font-semibold text-ink"
            >
              {hasExistingPin ? '새 PIN 번호' : 'PIN 번호'}
            </label>
            <input
              id="new-pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="4~6자리 숫자"
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border-2 border-border-card px-4 py-3 text-xl tracking-widest text-ink focus:border-primary focus:outline-none"
            />
          </div>

          {/* 새 PIN 확인 */}
          <div>
            <label
              htmlFor="new-pin-confirm-input"
              className="block text-base font-semibold text-ink"
            >
              {hasExistingPin ? '새 PIN 번호 확인' : 'PIN 번호 확인'}
            </label>
            <input
              id="new-pin-confirm-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={newPinConfirm}
              onChange={(e) => setNewPinConfirm(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="동일한 4~6자리 숫자 재입력"
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border-2 border-border-card px-4 py-3 text-xl tracking-widest text-ink focus:border-primary focus:outline-none"
            />
          </div>

          {/* PIN 해제 버튼 (기존 PIN이 있을 때) — 파괴적 행동이라 좌우 쌍과 분리해 둔다 */}
          {hasExistingPin && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleRemovePin()}
              className="flex h-12 w-full items-center justify-center rounded-2xl border-2 border-red-200 bg-red-50 text-lg font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              PIN 번호 해제 (무인증으로 변경)
            </button>
          )}

          {/* 좌 보조(닫기) / 우 주요(저장) (DESIGN.md §8.5) */}
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-btn-neutral text-lg font-semibold text-ink hover:brightness-95"
            >
              닫기
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !newPin || !newPinConfirm}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary px-2 text-lg font-bold text-white shadow hover:brightness-95 disabled:bg-btn-neutral disabled:text-ink-tertiary"
            >
              {isSubmitting ? '저장 중…' : hasExistingPin ? 'PIN 번호 변경하기' : 'PIN 번호 등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
