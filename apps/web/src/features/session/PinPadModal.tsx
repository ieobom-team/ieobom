import { useCallback, useEffect, useState } from 'react'
import { verifyStaffPin } from './staffApi'
import type { Staff } from './staffDirectory'

export type PinPadModalProps = {
  staff: Staff
  onSuccess: () => void
  onClose: () => void
}

const MAX_PIN_LENGTH = 6
const MIN_PIN_LENGTH = 4

/**
 * 4~6자리 숫자 PIN 입력 및 검증 모달. (Manyfast F-YJJJUX, #83, #84)
 *
 * - 0~9 큰 터치 패드 및 PC 물리 키보드(0~9, Backspace, Enter, Escape) 지원
 * - 실패 시 흔들림 애니메이션과 잔여 시도 횟수 안내
 * - 5회 연속 실패 시 1분간 잠금 안내 및 입력 비활성화
 */
export function PinPadModal({ staff, onSuccess, onClose }: PinPadModalProps) {
  const [pin, setPin] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(60)

  // 1분 잠금 카운트다운 타이머
  useEffect(() => {
    if (!isLocked) return

    setLockRemainingSeconds(60)
    const interval = window.setInterval(() => {
      setLockRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setIsLocked(false)
          setErrorMessage(null)
          return 60
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isLocked])

  const handleVerify = useCallback(
    async (pinToVerify: string) => {
      if (pinToVerify.length < MIN_PIN_LENGTH || isSubmitting || isLocked) {
        return
      }

      setIsSubmitting(true)
      setErrorMessage(null)

      try {
        const result = await verifyStaffPin(staff.code, pinToVerify)
        if (result.valid) {
          onSuccess()
          return
        }

        // 검증 실패
        setPin('')
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 500)

        if (result.locked || result.remainingAttempts <= 0) {
          setIsLocked(true)
          setErrorMessage(
            '5회 연속 실패하여 1분간 입력이 제한됩니다. PIN을 잊으셨다면 관리자에게 초기화를 요청하세요.',
          )
        } else {
          setErrorMessage(
            `PIN 번호가 일치하지 않습니다. (남은 시도: ${result.remainingAttempts}회)`,
          )
        }
      } catch (err: unknown) {
        setPin('')
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 500)
        setErrorMessage(
          err instanceof Error ? err.message : 'PIN 검증에 실패했습니다. 다시 시도해 주세요.',
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [staff.code, isSubmitting, isLocked, onSuccess],
  )

  const handleAppendDigit = useCallback(
    (digit: string) => {
      if (isSubmitting || isLocked) return
      setErrorMessage(null)
      setPin((prev) => {
        if (prev.length >= MAX_PIN_LENGTH) return prev
        const next = prev + digit
        return next
      })
    },
    [isSubmitting, isLocked],
  )

  const handleDelete = useCallback(() => {
    if (isSubmitting || isLocked) return
    setErrorMessage(null)
    setPin((prev) => prev.slice(0, -1))
  }, [isSubmitting, isLocked])

  const handleClear = useCallback(() => {
    if (isSubmitting || isLocked) return
    setErrorMessage(null)
    setPin('')
  }, [isSubmitting, isLocked])

  // 물리 키보드 리스너
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (isLocked || isSubmitting) {
        return
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleAppendDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleDelete()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (pin.length >= MIN_PIN_LENGTH) {
          void handleVerify(pin)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, isLocked, isSubmitting, handleAppendDigit, handleDelete, handleVerify, pin])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
    >
      <div
        className={`w-full max-w-sm rounded-3xl bg-surface-modal p-6 shadow-2xl transition-transform ${
          isShaking ? 'animate-bounce' : ''
        }`}
        style={
          isShaking
            ? {
                animation: 'shake 0.4s ease-in-out',
              }
            : undefined
        }
      >
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-8px); }
            40%, 80% { transform: translateX(8px); }
          }
        `}</style>

        {/* 상단 직원 정보 및 닫기 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 id="pin-modal-title" className="text-2xl font-bold text-ink">
              PIN 번호 입력
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

        {/* 마스킹 인디케이터 */}
        <div className="my-6 flex justify-center gap-3">
          {Array.from({ length: MAX_PIN_LENGTH }).map((_, idx) => {
            const isFilled = idx < pin.length
            return (
              <div
                key={idx}
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                  isFilled ? 'bg-primary scale-110' : 'border-2 border-border-card bg-btn-neutral'
                }`}
                aria-hidden="true"
              >
                {isFilled && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
              </div>
            )
          })}
        </div>

        {/* 오류 및 잠금 안내 메시지 */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3 text-center text-base font-semibold text-red-700"
          >
            {errorMessage}
            {isLocked && (
              <p className="mt-1 text-sm font-bold text-red-800">
                남은 제한 시간: {lockRemainingSeconds}초
              </p>
            )}
          </div>
        )}

        {/* 0~9 터치 키패드 그리드 */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isLocked || isSubmitting}
              onClick={() => handleAppendDigit(String(num))}
              className="flex h-16 items-center justify-center rounded-2xl border border-border-card bg-white text-2xl font-bold text-ink shadow-sm active:bg-primary-soft disabled:opacity-40"
            >
              {num}
            </button>
          ))}

          {/* 전체 삭제 */}
          <button
            type="button"
            disabled={isLocked || isSubmitting || pin.length === 0}
            onClick={handleClear}
            className="flex h-16 items-center justify-center rounded-2xl border border-border-card bg-btn-neutral text-lg font-semibold text-ink-muted shadow-sm active:brightness-95 disabled:opacity-40"
          >
            초기화
          </button>

          {/* 0 */}
          <button
            type="button"
            disabled={isLocked || isSubmitting}
            onClick={() => handleAppendDigit('0')}
            className="flex h-16 items-center justify-center rounded-2xl border border-border-card bg-white text-2xl font-bold text-ink shadow-sm active:bg-primary-soft disabled:opacity-40"
          >
            0
          </button>

          {/* 백스페이스 */}
          <button
            type="button"
            disabled={isLocked || isSubmitting || pin.length === 0}
            onClick={handleDelete}
            aria-label="한 글자 지우기"
            className="flex h-16 items-center justify-center rounded-2xl border border-border-card bg-btn-neutral text-xl font-bold text-ink shadow-sm active:brightness-95 disabled:opacity-40"
          >
            ⌫
          </button>
        </div>

        {/* 하단 확인 버튼 — 좌 보조(취소) / 우 주요(확인) (DESIGN.md §8.5) */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-btn-neutral text-xl font-semibold text-ink hover:brightness-95"
          >
            취소
          </button>

          <button
            type="button"
            disabled={pin.length < MIN_PIN_LENGTH || isSubmitting || isLocked}
            onClick={() => void handleVerify(pin)}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white shadow hover:brightness-95 disabled:bg-btn-neutral disabled:text-ink-tertiary"
          >
            {isSubmitting ? '확인 중…' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
