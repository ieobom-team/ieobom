import { Link } from 'react-router'
import { SessionHeader } from '../session/SessionHeader'

/**
 * 유저플로우 "새 플로우 3" n5 · "AI 인계 도구 내비게이션 맵" n42 — 관리자 홈.
 *
 * 관리자 홈에서 당일 운영 현황 대시보드(/admin/dashboard)와 어르신 명단 관리(/admin/care-recipients)로 이동한다.
 */
export function AdminHomePage() {
  return (
    <div className="min-h-svh bg-slate-50">
      <SessionHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-8">
        <h1 className="text-3xl font-bold text-slate-900">관리자 홈</h1>
        <p className="mt-4 text-xl text-slate-600">
          오늘 등록된 인계와 아직 닫히지 않은 업무를 한 화면에서 확인합니다.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <Link
            to="/admin/dashboard"
            className="flex min-h-20 w-full items-center rounded-2xl bg-teal-700 px-6 py-5 text-2xl font-semibold text-white hover:bg-teal-800"
          >
            당일 운영 현황 보기
          </Link>

          {/* n58 — 어르신 명단 화면(n49)으로 이동한다. */}
          <Link
            to="/admin/care-recipients"
            className="flex min-h-20 w-full items-center rounded-2xl border-2 border-slate-300 bg-white px-6 py-5 text-2xl font-semibold text-slate-900 hover:border-teal-600 hover:bg-teal-50"
          >
            어르신 명단
          </Link>
        </div>
      </main>
    </div>
  )
}
