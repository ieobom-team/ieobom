import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { BigButton } from '../../shared/ui/BigButton'
import type { JobRole } from '../handover-card/handoverCardApi'
import { ENTRY_ROLES, findEntryRole, homePathOf, type EntryRole } from './entryRole'
import { useSession } from './sessionContext'
import type { Staff } from './staffDirectory'
import { useStaffDirectory } from './useStaffDirectory'

const JOB_ROLE_PRIORITY: Record<JobRole, number> = {
  CAREGIVER: 1,
  NURSE_AIDE: 2,
  SOCIAL_WORKER: 3,
  DRIVER: 4,
  CENTER_HEAD: 5,
}

function compareStaff(a: Staff, b: Staff): number {
  const orderA = a.jobRole ? JOB_ROLE_PRIORITY[a.jobRole] ?? 99 : 99
  const orderB = b.jobRole ? JOB_ROLE_PRIORITY[b.jobRole] ?? 99 : 99
  if (orderA !== orderB) {
    return orderA - orderB
  }
  return a.name.localeCompare(b.name, 'ko')
}

/**
 * 유저플로우 "새 플로우 3" n2 — 역할·본인 식별 선택 화면.
 *
 * 로그인이 아니다. 비밀번호를 받지 않고, 진입 역할 2종과 본인만 고른다.
 * 고르고 나면 n3 분기대로 각 역할의 홈으로 간다.
 *
 * 본인 선택 목록은 **센터가 사전 등록한 직원 명단**에서 온다. (Manyfast F-YJJJUX permissions, #33)
 * 이 화면에서 명단을 고치지 않는다 — 직원 명단 관리 화면은 만들지 않는다.
 */
export function EntrySelectPage() {
  const { session, enter } = useSession()
  const navigate = useNavigate()
  const [pickedRole, setPickedRole] = useState<EntryRole | null>(null)
  const directory = useStaffDirectory()
  const staffList = directory.data ?? []
  const sortedStaff = [...staffList].sort(compareStaff)

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

          {directory.isPending ? (
            <p className="text-xl text-slate-600">명단을 불러오는 중입니다…</p>
          ) : directory.isError ? (
            // 캐시까지 비어 있을 때만 여기로 온다. 받아 둔 명단이 있으면 그것으로 고르게 한다.
            <div className="flex flex-col items-start gap-4">
              <p className="text-xl text-slate-700">
                직원 명단을 불러오지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.
              </p>
              <BigButton tone="plain" onClick={() => void directory.refetch()}>
                명단 다시 불러오기
              </BigButton>
            </div>
          ) : sortedStaff.length === 0 ? (
            <p className="text-xl text-slate-700">
              등록된 직원이 없습니다. 센터 관리자에게 명단 등록을 요청해 주세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {sortedStaff.map((staff) => (
                <li key={staff.code}>
                  <BigButton tone="plain" onClick={() => handlePickStaff(staff)}>
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      <span>{staff.name}</span>
                      {staff.jobRoleLabel && (
                        <span className="rounded-lg bg-teal-100 px-2.5 py-0.5 text-base font-semibold text-teal-800">
                          {staff.jobRoleLabel}
                        </span>
                      )}
                      <span className="text-lg font-normal text-slate-500">{staff.code}</span>
                    </span>
                  </BigButton>
                </li>
              ))}
            </ul>
          )}

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
