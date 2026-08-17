import { useState } from 'react'
import { resetStaffPin } from '../session/staffApi'
import type { Staff } from '../session/staffDirectory'
import { useStaffDirectory } from '../session/useStaffDirectory'

/**
 * 관리자 1-Click 직원 PIN 초기화 섹션. (Manyfast F-YJJJUX exceptions, #83, #84)
 *
 * PIN을 분실하거나 5회 연속 실패로 잠긴 직원의 PIN을 원클릭으로 해제(초기화)한다.
 */
export function AdminStaffPinResetSection() {
  const directory = useStaffDirectory()
  const [resettingCode, setResettingCode] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const staffList = directory.data ?? []

  const handleResetPin = async (staff: Staff) => {
    if (!window.confirm(`${staff.name}(${staff.code}) 님의 PIN 번호를 초기화하시겠습니까?`)) {
      return
    }

    setResettingCode(staff.code)
    setFeedbackMessage(null)
    setErrorMessage(null)

    try {
      await resetStaffPin(staff.code)
      await directory.refetch()
      setFeedbackMessage(`${staff.name} 님의 PIN이 초기화(무인증)되었습니다.`)
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'PIN 초기화에 실패했습니다. 다시 시도해 주세요.',
      )
    } finally {
      setResettingCode(null)
    }
  }

  return (
    <section aria-labelledby="pin-reset-heading" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="pin-reset-heading" className="text-2xl font-bold text-slate-900">
        직원 PIN 초기화 관리
      </h2>
      <p className="mt-2 text-lg text-slate-600">
        PIN을 분실하거나 잠긴 직원의 PIN을 1-Click으로 초기화합니다.
      </p>

      {feedbackMessage && (
        <div
          role="status"
          className="mt-4 rounded-xl bg-teal-50 p-3 text-base font-semibold text-teal-800"
        >
          ✓ {feedbackMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-base font-semibold text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {directory.isPending ? (
        <p className="mt-4 text-lg text-slate-500">직원 명단을 불러오는 중입니다…</p>
      ) : directory.isError ? (
        <p className="mt-4 text-lg text-red-600">직원 명단을 불러오지 못했습니다.</p>
      ) : staffList.length === 0 ? (
        <p className="mt-4 text-lg text-slate-500">등록된 직원이 없습니다.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {staffList.map((staff) => (
            <li key={staff.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-slate-900">{staff.name}</span>
                {staff.jobRoleLabel && (
                  <span className="rounded-lg bg-teal-100 px-2 py-0.5 text-sm font-semibold text-teal-800">
                    {staff.jobRoleLabel}
                  </span>
                )}
                <span className="text-base text-slate-500">{staff.code}</span>
                {staff.hasPin ? (
                  <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    🔒 PIN 설정됨
                  </span>
                ) : (
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    무인증
                  </span>
                )}
              </div>

              {staff.hasPin && (
                <button
                  type="button"
                  disabled={resettingCode === staff.code}
                  onClick={() => void handleResetPin(staff)}
                  className="rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-base font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {resettingCode === staff.code ? '초기화 중…' : 'PIN 초기화'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
