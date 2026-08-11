import { findEntryRole } from './entryRole'
import { useSession } from './sessionContext'

/**
 * 지금 누구로 들어와 있는지 보여 준다.
 *
 * 현장에서는 한 기기를 여러 직원이 돌려 쓰므로 다른 사람으로 바꾸는 길이 화면에 있어야 한다.
 * 선택을 지우면 진입 선택 화면으로 되돌아간다.
 */
export function SessionHeader() {
  const { session, leave } = useSession()
  if (!session) {
    return null
  }

  const role = findEntryRole(session.entryRole)

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
      <p className="text-xl text-slate-700">
        <span className="font-semibold text-slate-900">{session.staff.name}</span>
        <span className="ml-2 text-lg text-slate-500">{session.staff.code}</span>
        <span className="ml-3 rounded-full bg-teal-50 px-3 py-1 text-lg font-semibold text-teal-800">
          {role.label}
        </span>
      </p>
      {/* 선택을 지우면 라우트 가드가 진입 선택 화면으로 되돌린다. */}
      <button
        type="button"
        onClick={leave}
        className="rounded-xl border-2 border-slate-300 px-4 py-3 text-xl font-semibold text-slate-700"
      >
        본인 바꾸기
      </button>
    </header>
  )
}
