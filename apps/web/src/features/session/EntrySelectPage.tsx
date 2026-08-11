import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { BigButton } from '../../shared/ui/BigButton'
import { ENTRY_ROLES, findEntryRole, homePathOf, type EntryRole } from './entryRole'
import { useSession } from './sessionContext'
import { STAFF_DIRECTORY, type Staff } from './staffDirectory'

/**
 * 유저플로우 n2 — 역할·본인 식별 선택 화면.
 *
 * 로그인이 아니다. 비밀번호를 받지 않고, 진입 역할 2종과 본인만 고른다.
 * 고르고 나면 n3 분기대로 각 역할의 홈으로 간다.
 */
export function EntrySelectPage() {
  const { session, enter } = useSession()
  const navigate = useNavigate()
  const [pickedRole, setPickedRole] = useState<EntryRole | null>(null)

  // 이미 고른 상태로 다시 들어오면 자기 홈으로 보낸다. 바꾸려면 홈에서 '본인 바꾸기'를 누른다.
  if (session) {
    return <Navigate to={homePathOf(session.entryRole)} replace />
  }

  const handlePickStaff = (staff: Staff) => {
    if (!pickedRole) {
      return
    }
    enter(pickedRole, staff)
    navigate(homePathOf(pickedRole), { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-8 px-5 py-10">
      <header>
        <h1 className="text-4xl font-bold text-slate-900">이어봄</h1>
        <p className="mt-3 text-xl text-slate-600">
          비밀번호 없이 오늘 쓸 화면과 본인만 고르면 됩니다.
        </p>
      </header>

      {pickedRole === null ? (
        <section aria-labelledby="role-heading" className="flex flex-col gap-5">
          <h2 id="role-heading" className="text-2xl font-bold text-slate-900">
            1. 어떤 화면으로 들어가시나요?
          </h2>
          {ENTRY_ROLES.map((role) => (
            <BigButton key={role.value} onClick={() => setPickedRole(role.value)}>
              <span className="block">{role.label}</span>
              <span className="mt-1 block text-lg font-normal opacity-90">{role.summary}</span>
            </BigButton>
          ))}
        </section>
      ) : (
        <section aria-labelledby="staff-heading" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="staff-heading" className="text-2xl font-bold text-slate-900">
              2. 본인을 골라 주세요
            </h2>
            <p className="text-xl text-slate-600">{findEntryRole(pickedRole).label}</p>
          </div>

          <ul className="flex flex-col gap-4">
            {STAFF_DIRECTORY.map((staff) => (
              <li key={staff.code}>
                <BigButton tone="plain" onClick={() => handlePickStaff(staff)}>
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span>{staff.name}</span>
                    <span className="text-lg font-normal text-slate-500">{staff.code}</span>
                  </span>
                </BigButton>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setPickedRole(null)}
            className="self-start rounded-xl px-4 py-3 text-xl font-semibold text-teal-800 underline underline-offset-4"
          >
            역할 다시 고르기
          </button>
        </section>
      )}
    </main>
  )
}
